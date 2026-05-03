/**
 * FileReference Value Object
 * Represents a file in a group with optional line range
 */

import { ContextMode } from './ContextMode';

export interface LineRange {
  start: number;
  end: number;
}

export interface FileReference {
  uri: string; // VS Code file URI
  relativePath: string; // For portability and display
  lines?: LineRange; // Optional: only include specific lines
  overrideContextMode?: ContextMode; // Per-file override
}

export function validateFileReference(ref: any): ref is FileReference {
  if (!ref || typeof ref !== 'object') return false;
  if (!ref.uri || typeof ref.uri !== 'string') return false;
  if (!ref.relativePath || typeof ref.relativePath !== 'string') return false;

  if (ref.lines) {
    if (!ref.lines.start || !ref.lines.end || typeof ref.lines.start !== 'number' || typeof ref.lines.end !== 'number') {
      return false;
    }
    if (ref.lines.start < 1 || ref.lines.end < ref.lines.start) {
      return false;
    }
  }

  return true;
}

export function createFileReference(uri: string, relativePath: string, overrideContextMode?: ContextMode): FileReference {
  return {
    uri,
    relativePath,
    overrideContextMode,
  };
}
