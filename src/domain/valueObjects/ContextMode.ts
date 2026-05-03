/**
 * ContextMode Value Object
 * Defines how code context is extracted from files
 */

export type ContextModeType =
  | 'full'
  | 'docstring'
  | 'headers'
  | 'skeleton'
  | 'head-tail'
  | 'smart';

export interface ContextMode {
  type: ContextModeType;
  maxLines?: number;           // For 'headers' mode
  headLines?: number;          // For 'head-tail' mode
  tailLines?: number;          // For 'head-tail' mode
  heuristic?: 'main-exports' | 'public-api'; // For 'smart' mode
}

export function validateContextMode(mode: any): mode is ContextMode {
  if (!mode || typeof mode !== 'object') return false;
  if (!mode.type || typeof mode.type !== 'string') return false;

  const validTypes: ContextModeType[] = ['full', 'docstring', 'headers', 'skeleton', 'head-tail', 'smart'];
  if (!validTypes.includes(mode.type)) return false;

  if (mode.type === 'headers' && (!mode.maxLines || typeof mode.maxLines !== 'number' || mode.maxLines <= 0)) {
    return false;
  }

  if (mode.type === 'head-tail' && (
    !mode.headLines || typeof mode.headLines !== 'number' || mode.headLines <= 0 ||
    !mode.tailLines || typeof mode.tailLines !== 'number' || mode.tailLines <= 0
  )) {
    return false;
  }

  return true;
}
