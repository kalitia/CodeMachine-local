
import { metadata } from '../metadata.js';

export interface LocalCommandOptions {
  localApiUri: string;
  localApiPath: string;
  localApiKey?: string;
  stream: boolean;
  prompt: string;
  model?: string;
  modelReasoningEffort?: undefined | 'low' | 'medium' | 'high';
}

export interface LocalCommand {
  command: string;
  args: string[];
}

export function buildLocalExecCommand(options: LocalCommandOptions): LocalCommand {
  const { localApiUri, localApiPath, localApiKey, /*stream, prompt, model, modelReasoningEffort*/ } = options;

  const args = [
    "-ss",
    "-X", "POST",
    "-L", `${localApiUri}${localApiPath}`,
    "-H", "Content-Type: application/json",
    "-H", `Authorization: Bearer ${localApiKey}`,
    "--data-binary", "@-"
  ];

  return {
    command: metadata.cliCommand,
    args,
  };
}
