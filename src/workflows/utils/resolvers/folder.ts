import { existsSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import type { StepOverrides, WorkflowStep } from '../types.js';
import { mainAgents, packageRoot } from '../config.js';

function extractOrderPrefix(filename: string): number | null {
  const match = filename.match(/^(\d+)\s*-/);
  return match ? parseInt(match[1], 10) : null;
}

export function resolveFolder(folderName: string, overrides: StepOverrides = {}): WorkflowStep[] {
  // Look up folder configuration from main.agents.js
  const folderConfig = mainAgents.find((entry) => entry?.type === 'folder' && entry?.id === folderName);

  if (!folderConfig) {
    throw new Error(`Folder configuration not found in main.agents.js: ${folderName}`);
  }

  const promptsDir = path.resolve(packageRoot, 'prompts', 'templates', folderName);

  if (!existsSync(promptsDir) || !statSync(promptsDir).isDirectory()) {
    throw new Error(`Folder not found: prompts/templates/${folderName}`);
  }

  const files = readdirSync(promptsDir);

  // Filter and sort files by their numeric prefix
  const orderedFiles = files
    .map((file) => ({
      file,
      order: extractOrderPrefix(file),
      fullPath: path.join(promptsDir, file),
    }))
    .filter((item) => item.order !== null && statSync(item.fullPath).isFile())
    .sort((a, b) => (a.order! - b.order!));

  if (orderedFiles.length === 0) {
    throw new Error(`No ordered files found in folder: prompts/templates/${folderName}`);
  }

  // Create a step for each file using folder config
  return orderedFiles.map((item) => {
    const basename = item.file;
    const ext = path.extname(basename);

    // Remove number prefix and extension to get the agent ID
    const agentId = basename.replace(/^\d+\s*-\s*/, '').replace(ext, '').trim();
    const promptPath = `prompts/templates/${folderName}/${basename}`;
    const model = overrides.model ?? folderConfig.model;

    if (!model) {
      throw new Error(`Folder config ${folderName} is missing a model configuration`);
    }

    return {
      type: 'module',
      agentId,
      agentName: overrides.agentName ?? agentId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      promptPath: overrides.promptPath ?? promptPath,
      model,
      modelReasoningEffort: overrides.modelReasoningEffort ?? folderConfig.modelReasoningEffort,
    };
  });
}
