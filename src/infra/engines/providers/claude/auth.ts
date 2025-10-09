import { stat, rm, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';

import { expandHomeDir } from '../../../../shared/utils/index.js';
import { metadata } from './metadata.js';

/**
 * Check if CLI is installed
 */
async function isCliInstalled(command: string): Promise<boolean> {
  try {
    await execa(command, ['--version'], { timeout: 3000, reject: false });
    return true;
  } catch {
    return false;
  }
}

export interface ClaudeAuthOptions {
  profile?: string;
  claudeConfigDir?: string;
}

/**
 * Resolves the Claude config directory (shared for authentication)
 * Profile is only used for agent-specific data, not authentication
 */
export function resolveClaudeConfigDir(options?: ClaudeAuthOptions): string {
  if (options?.claudeConfigDir) {
    return expandHomeDir(options.claudeConfigDir);
  }

  if (process.env.CLAUDE_CONFIG_DIR) {
    return expandHomeDir(process.env.CLAUDE_CONFIG_DIR);
  }

  // Authentication is shared across all profiles
  return path.join(homedir(), '.codemachine', 'claude');
}

/**
 * Gets the path to the credentials file
 * Claude stores it directly in CLAUDE_CONFIG_DIR
 */
export function getCredentialsPath(configDir: string): string {
  return path.join(configDir, '.credentials.json');
}

/**
 * Gets paths to all Claude-related files that need to be cleaned up
 */
export function getClaudeAuthPaths(configDir: string): string[] {
  return [
    getCredentialsPath(configDir), // .credentials.json
    path.join(configDir, '.claude.json'),
    path.join(configDir, '.claude.json.backup'),
  ];
}

/**
 * Checks if Claude is authenticated for the given profile
 */
export async function isAuthenticated(options?: ClaudeAuthOptions): Promise<boolean> {
  // Check if token is set via environment variable
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return true;
  }

  const configDir = resolveClaudeConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  try {
    await stat(credPath);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Ensures Claude is authenticated, running setup-token if needed
 */
export async function ensureAuth(options?: ClaudeAuthOptions): Promise<boolean> {
  // Check if token is already set via environment variable
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return true;
  }

  const configDir = resolveClaudeConfigDir(options);
  const credPath = getCredentialsPath(configDir);

  // If already authenticated, nothing to do
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file doesn't exist
  }

  if (process.env.CODEMACHINE_SKIP_AUTH === '1') {
    // Create a placeholder for testing/dry-run mode
    const claudeDir = path.dirname(credPath);
    await mkdir(claudeDir, { recursive: true });
    await writeFile(credPath, '{}', { encoding: 'utf8' });
    return true;
  }

  // Check if CLI is installed
  const cliInstalled = await isCliInstalled(metadata.cliBinary);
  if (!cliInstalled) {
    console.error(`\n────────────────────────────────────────────────────────────`);
    console.error(`  ⚠️  ${metadata.name} CLI Not Installed`);
    console.error(`────────────────────────────────────────────────────────────`);
    console.error(`\nThe '${metadata.cliBinary}' command is not available.`);
    console.error(`Please install ${metadata.name} CLI first:\n`);
    console.error(`  ${metadata.installCommand}\n`);
    console.error(`────────────────────────────────────────────────────────────\n`);
    throw new Error(`${metadata.name} CLI is not installed.`);
  }

  // Run interactive setup-token via Claude CLI with proper env
  console.log(`\nRunning Claude authentication...\n`);
  console.log(`Config directory: ${configDir}\n`);

  try {
    await execa('claude', ['setup-token'], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
      stdio: 'inherit',
    });
  } catch (error) {
    const err = error as unknown as { code?: string; stderr?: string; message?: string };
    const stderr = err?.stderr ?? '';
    const message = err?.message ?? '';
    const notFound =
      err?.code === 'ENOENT' ||
      /not recognized as an internal or external command/i.test(stderr || message) ||
      /command not found/i.test(stderr || message) ||
      /No such file or directory/i.test(stderr || message);

    if (notFound) {
      console.error(`\n────────────────────────────────────────────────────────────`);
      console.error(`  ⚠️  ${metadata.name} CLI Not Found`);
      console.error(`────────────────────────────────────────────────────────────`);
      console.error(`\n'${metadata.cliBinary} setup-token' failed because the CLI is missing.`);
      console.error(`Please install ${metadata.name} CLI before trying again:\n`);
      console.error(`  ${metadata.installCommand}\n`);
      console.error(`────────────────────────────────────────────────────────────\n`);
      throw new Error(`${metadata.name} CLI is not installed.`);
    }

    throw error;
  }

  // Verify the credentials were created
  try {
    await stat(credPath);
    return true;
  } catch {
    // Credentials file wasn't created - Claude CLI returned token instead
    console.error(`\n────────────────────────────────────────────────────────────`);
    console.error(`  ℹ️  Claude CLI Authentication Notice`);
    console.error(`────────────────────────────────────────────────────────────`);
    console.error(`\nYour Claude CLI installation uses token-based authentication.`);
    console.error(`Please set the token you received as an environment variable:\n`);
    console.error(`  export CLAUDE_CODE_OAUTH_TOKEN=<your-token>\n`);
    console.error(`For persistence, add this line to your shell configuration:`);
    console.error(`  ~/.bashrc (Bash) or ~/.zshrc (Zsh)\n`);
    console.error(`────────────────────────────────────────────────────────────\n`);

    throw new Error('Authentication incomplete. Please set CLAUDE_CODE_OAUTH_TOKEN environment variable.');
  }
}

/**
 * Clears all Claude authentication data for the given profile
 */
export async function clearAuth(options?: ClaudeAuthOptions): Promise<void> {
  const configDir = resolveClaudeConfigDir(options);
  const authPaths = getClaudeAuthPaths(configDir);

  // Remove all auth-related files
  await Promise.all(
    authPaths.map(async (authPath) => {
      try {
        await rm(authPath, { force: true });
      } catch (_error) {
        // Ignore removal errors; treat as cleared
      }
    }),
  );
}

/**
 * Returns the next auth menu action based on current auth state
 */
export async function nextAuthMenuAction(options?: ClaudeAuthOptions): Promise<'login' | 'logout'> {
  return (await isAuthenticated(options)) ? 'logout' : 'login';
}
