import type { EngineMetadata } from '../../core/base.js';

export interface LocalEngineMetadata extends EngineMetadata {
  localApiUri: string;
  localApiPath: string;
  localApiKey?: string;
  stream: boolean;
}

export const metadata: LocalEngineMetadata = {
  id: 'local',
  name: 'Local',
  description: 'Local AI models via local server (OpenAI compatible)',
  cliCommand: 'curl',
  cliBinary: 'lms',
  installCommand: 'Install LM Studio from https://lmstudio.ai/',
  localApiUri: 'http://localhost:1234',
  localApiPath: '/v1/responses',
  localApiKey: 'lm-studio',
  stream: false,
  defaultModel: 'qwen3-coder-30b-a3b-instruct',
  defaultModelReasoningEffort: undefined,
  order: 100,
};