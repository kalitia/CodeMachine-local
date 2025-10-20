/**
 * Local engine configuration and model mapping
 */

export interface LocalConfig {
  /**
   * Model to use for Local execution
   * Available models: auto, qwen3-coder-30b-a3b-instruct, unsloth/glm-4.5-air, openai/gpt-oss-120b
   */
  model?: string;

  /**
   * Profile/agent ID to use for this execution
   */
  profile: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Optional custom Local config directory
   * Defaults to ~/.codemachine/local/{profile}
   */
  localConfigDir?: string;
}

/**
 * Available LMStudio models
 */
export const LOCAL_MODELS = {
  AUTO: 'auto',
  QWEN_3_CODER: 'qwen3-coder-30b-a3b-instruct',
  GLM_4_5_AIR: 'unsloth/glm-4.5-air',
  OPENAI_GPT_OSS_120B: 'openai/gpt-oss-120b',
} as const;

/**
 * Model mapping from generic model names to LMStudio models
 * This allows using config with 'gpt-5-codex' or 'gpt-4' to map to Local models
 */
export const MODEL_MAPPING: Record<string, string> = {
  // Map common model names to LMStudio equivalents
  'gpt-5-codex': LOCAL_MODELS.QWEN_3_CODER,
  'gpt-4': LOCAL_MODELS.QWEN_3_CODER,
  'gpt-4-turbo': LOCAL_MODELS.QWEN_3_CODER,
  'gpt-3.5-turbo': LOCAL_MODELS.QWEN_3_CODER,
  'o1-preview': LOCAL_MODELS.QWEN_3_CODER,
  'o1-mini': LOCAL_MODELS.QWEN_3_CODER,
  'sonnet': LOCAL_MODELS.QWEN_3_CODER,
  'claude-sonnet-4.5': LOCAL_MODELS.QWEN_3_CODER,
  'opus': LOCAL_MODELS.QWEN_3_CODER,
};

/**
 * Resolves a model name to a Local model
 * Returns undefined if the model should use Local's default (auto)
 */
export function resolveModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // Check if it's in our mapping
  if (model in MODEL_MAPPING) {
    return MODEL_MAPPING[model];
  }

  // If it's already a Local model name, return it
  const localModelValues = Object.values(LOCAL_MODELS) as string[];
  if (localModelValues.includes(model)) {
    return model;
  }

  // Otherwise, return undefined to use Local's default (auto)
  return undefined;
}

/**
 * Default timeout for Local operations (30 minutes)
 */
export const DEFAULT_TIMEOUT = 1800000;

/**
 * Environment variable names
 */
export const ENV = {
  LOCAL_CONFIG_DIR: 'LOCAL_CONFIG_DIR',
  SKIP_LOCAL: 'CODEMACHINE_SKIP_LOCAL',
  SKIP_AUTH: 'CODEMACHINE_SKIP_AUTH',
  PLAIN_LOGS: 'CODEMACHINE_PLAIN_LOGS',
} as const;
