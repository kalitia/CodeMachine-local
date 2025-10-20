import * as path from 'node:path';
import { homedir } from 'node:os';

import { spawnProcess } from '../../../../process/spawn.js';
import { buildLocalExecCommand } from './commands.js';
import { metadata } from '../metadata.js';
import { expandHomeDir } from '../../../../../shared/utils/index.js';
import { logger } from '../../../../../shared/logging/index.js';
import { createTelemetryCapture } from '../../../../../shared/telemetry/index.js';

export interface RunLocalOptions {
  prompt: string;
  workingDir: string;
  model?: string;
  modelReasoningEffort?: undefined | 'low' | 'medium' | 'high';
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number; // Timeout in milliseconds (default: 1800000ms = 30 minutes)
}

export interface RunLocalResult {
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');

/**
 * Formats a Local stream-json line for display
 */
function formatLocalStreamJsonLine(line: string): string | null {
  try {
    const json = JSON.parse(line);

    // Handle reasoning items (thinking)
    if (json.status === 'completed' && json.output[0]?.type === 'reasoning') {
      return `🧠 THINKING: ${json.output[0]?.content[0]?.text}`;
    }

    // Handle command execution
    if ((json.type === 'in_progress' || json.type === 'incomplete' || json.type === 'calling') &&
        (json.output[0]?.type === 'mcp_call' || json.output[0]?.type === 'mcp_approval_request' || json.output[0]?.type === 'custom_tool_call')) {
      return `🔧 COMMAND: ${json.output[0]?.name}`;
    }

    if (json.status === 'completed' && (json.output[0]?.type === 'mcp_call' || json.output[0]?.type === 'mcp_approval_request' || json.output[0]?.type === 'custom_tool_call')) {
      const exitCode = json.error.code ?? 0;
      if (exitCode === 0) {
        const preview = json.output[0]?.name
          ? json.output[0]?.name.substring(0, 100) + '...'
          : '';
        return `✅ COMMAND RESULT: ${preview}`;
      } else {
        return `❌ COMMAND FAILED: Exit code ${exitCode}`;
      }
    }

    // Handle agent messages
    if (json.status === 'completed' && json.output[0]?.type === 'message') {
      return `💬 MESSAGE: ${json.output[0]?.content[0]?.text}`;
    }

    // Handle turn/thread lifecycle events (skip these)
    if (json.status === 'started' || json.status === 'completed') {
      // Show usage info at turn completion
      if (json.status === 'completed' && json.usage) {
        const { input_tokens, cached_input_tokens, output_tokens } = json.usage;
        const totalIn = input_tokens + (cached_input_tokens || 0);
        return `⏱️  Tokens: ${totalIn}in/${output_tokens}out${cached_input_tokens ? ` (${cached_input_tokens} cached)` : ''}`;
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function runLocal(options: RunLocalOptions): Promise<RunLocalResult> {
  const {
    prompt,
    workingDir,
    model,
    modelReasoningEffort,
    env,
    onData,
    onErrorData,
    abortSignal,
    timeout = 1800000 } = options;

  if (!prompt) {
    throw new Error('runLocal requires a prompt.');
  }

  if (!workingDir) {
    throw new Error('runLocal requires a working directory.');
  }

  // Prefer calling the real Local CLI directly, mirroring runner-prompts spec
  // Example (Linux/Mac):
  //   LOCAL_HOME="$HOME/.codemachine/local" lms exec \
  //     --skip-git-repo-check \
  //     --sandbox danger-full-access --dangerously-bypass-approvals-and-sandbox \
  //     -C <workingDir> "<composite prompt>"

  // Expand platform-specific home directory variables in LOCAL_HOME
  const localHome = process.env.LOCAL_HOME
    ? expandHomeDir(process.env.LOCAL_HOME)
    : path.join(homedir(), '.codemachine', 'local');
  const mergedEnv = { ...process.env, ...(env ?? {}), LOCAL_HOME: localHome };

  const plainLogs = (process.env.CODEMACHINE_PLAIN_LOGS || '').toString() === '1';
  // Force pipe mode to ensure text normalization is applied
  const inheritTTY = false;

  const normalize = (text: string): string => {
    // Simple but effective approach to fix carriage return wrapping issues
    let result = text;

    // Handle carriage returns that cause line overwrites
    // When we see \r followed by text, it means the text should overwrite what came before
    // So we keep only the text after the last \r in each line
    result = result.replace(/^.*\r([^\r\n]*)/gm, '$1');

    if (plainLogs) {
      // Plain mode: strip all ANSI sequences
      result = result.replace(ANSI_ESCAPE_SEQUENCE, '');
    }

    // Clean up line endings
    result = result
      .replace(/\r\n/g, '\n')  // Convert CRLF to LF
      .replace(/\r/g, '\n')    // Convert remaining CR to LF
      .replace(/\n{3,}/g, '\n\n'); // Collapse excessive newlines

    return result;
  };

  //const { command, args } = buildLocalExecCommand({ workingDir, prompt, model, modelReasoningEffort });
  const localApiUri = metadata.localApiUri;
  const localApiPath = metadata.localApiPath;
  const localApiKey = metadata.localApiKey;
  const stream = metadata.stream;
  const { command, args } = buildLocalExecCommand({ localApiUri, localApiPath, localApiKey, stream, prompt, model, modelReasoningEffort });

  logger.debug(`Local runner - prompt length: ${prompt.length}, lines: ${prompt.split('\n').length}`);
  logger.debug(`Local runner - args count: ${args.length}`);
  logger.debug(
    `Local runner - CLI: ${command} ${args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')} | stdin preview: ${prompt.slice(0, 120)}`,
  );

  // Create telemetry capture instance
  const telemetryCapture = createTelemetryCapture('local', model, prompt, workingDir);

  const body: Record<string, unknown> = {
    model,
    input: prompt,
    stream
  };
  if (modelReasoningEffort) body.reasoning = { effort: modelReasoningEffort };
  const jsonBody = JSON.stringify(body);

  let result;
  try {
    result = await spawnProcess({
      command,
      args,
      cwd: workingDir,
      env: mergedEnv,
      stdinInput: jsonBody,
    onStdout: inheritTTY
      ? undefined
      : (chunk) => {
          const out = normalize(chunk);

          let data = out;
          if (stream && out.trim().startsWith('data: ')) {
            data = out.trim().substring(6); // Remove 'data: ' prefix
          }

          // Capture telemetry data
          telemetryCapture.captureFromStreamJson(data);

          const formatted = formatLocalStreamJsonLine(data);
          if (formatted) {
            onData?.(formatted + '\n');
          }
        },
    onStderr: inheritTTY
      ? undefined
      : (chunk) => {
          const out = normalize(chunk);
          onErrorData?.(out);
        },
    signal: abortSignal,
    stdioMode: inheritTTY ? 'inherit' : 'pipe',
      timeout,
    });
  } catch (error) {
    const err = error as unknown as { code?: string; message?: string };
    const message = err?.message ?? '';
    const notFound = err?.code === 'ENOENT' || /not recognized as an internal or external command/i.test(message) || /command not found/i.test(message);
    if (notFound) {
      const full = `${command} ${args.join(' ')}`.trim();
      const install = metadata.installCommand;
      const name = metadata.name;
      logger.error(`${name} CLI not found when executing: ${full}`);
      throw new Error(`'${command}' is not available on this system. Please install ${name} first:\n  ${install}`);
    }
    throw error;
  }

  logger.debug("Local runner - CLI Response:", result);

  if (result.exitCode !== 0) {
    const errorOutput = result.stderr.trim() || result.stdout.trim() || 'no error output';
    const lines = errorOutput.split('\n').slice(0, 10);

    logger.error('Local CLI execution failed', {
      exitCode: result.exitCode,
      error: lines.join('\n'),
      command: `${command} ${args.join(' ')}`,
    });

    throw new Error(`Local CLI exited with code ${result.exitCode}`);
  }

  // Log captured telemetry
  telemetryCapture.logCapturedTelemetry(result.exitCode);

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
