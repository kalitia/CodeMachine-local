export interface StepOverrides {
  agentName?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: string;
  engine?: string; // Dynamic engine type from registry
  executeOnce?: boolean;
  notCompletedFallback?: string;
}

export interface WorkflowStep {
  type: string;
  agentId: string;
  agentName: string;
  promptPath: string;
  model?: string;
  modelReasoningEffort?: string;
  engine?: string; // Dynamic engine type from registry
  module?: ModuleMetadata;
  executeOnce?: boolean;
  notCompletedFallback?: string;
}

export interface LoopBehaviorConfig {
  type: 'loop';
  action: 'stepBack';
  steps: number;
  trigger: string;
  maxIterations?: number;
  skip?: string[];
}

export interface ModuleMetadata {
  id: string;
  behavior?: LoopBehaviorConfig;
}

export interface ModuleOverrides extends StepOverrides {
  loopTrigger?: string;
  loopSteps?: number;
  loopMaxIterations?: number;
  loopSkip?: string[];
}
