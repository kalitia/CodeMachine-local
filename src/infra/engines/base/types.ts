/**
 * Base types and interfaces for the engine plugin system
 */

import type { EngineRunOptions, EngineRunResult } from '../types.js';

/**
 * Engine metadata - describes the engine for auto-discovery
 */
export interface EngineMetadata {
  /** Unique identifier for the engine (e.g., 'codex', 'claude') */
  id: string;
  /** Display name (e.g., 'Codex', 'Claude') */
  name: string;
  /** Description shown in UI (e.g., 'Authenticate with Claude AI') */
  description: string;
  /** CLI command namespace (e.g., 'codex', 'claude') */
  cliCommand: string;
  /** Display order in UI (lower = first) */
  order?: number;
  /** Whether this engine is experimental */
  experimental?: boolean;
  /** Optional icon for UI */
  icon?: string;
}

/**
 * Authentication module interface - all engines must implement these
 */
export interface EngineAuthModule {
  /** Check if the engine is authenticated */
  isAuthenticated(options?: unknown): Promise<boolean>;
  /** Ensure authentication, prompting user if needed */
  ensureAuth(options?: unknown): Promise<boolean>;
  /** Clear authentication credentials */
  clearAuth(options?: unknown): Promise<void>;
  /** Get the next auth menu action based on current state */
  nextAuthMenuAction(options?: unknown): Promise<'login' | 'logout'>;
}

/**
 * Complete engine module interface
 * All engines must export these to be auto-discovered
 */
export interface EngineModule {
  /** Engine metadata */
  metadata: EngineMetadata;
  /** Authentication module */
  auth: EngineAuthModule;
  /** Main execution function */
  run: (options: EngineRunOptions) => Promise<EngineRunResult>;
  /** Optional: Called when engine is registered */
  onRegister?: () => void;
  /** Optional: Called when engine is loaded */
  onLoad?: () => void;
}

/**
 * Type guard to check if an object is a valid EngineModule
 */
export function isEngineModule(obj: unknown): obj is EngineModule {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Partial<EngineModule>;
  return (
    !!candidate.metadata &&
    typeof candidate.metadata === 'object' &&
    !!candidate.auth &&
    typeof candidate.auth === 'object' &&
    typeof candidate.run === 'function'
  );
}
