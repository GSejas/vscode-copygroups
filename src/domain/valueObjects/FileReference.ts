/**
 * FileReference Value Object
 * Represents a file in a group with optional line range and repository context
 */

import { ContextMode } from './ContextMode';

export interface LineRange {
  start: number;
  end: number;
}

export interface RepositoryMetadata {
  rootPath?: string; // Absolute path to workspace/repo root
  workspaceName?: string; // Workspace folder name
  repoName?: string; // Repository or project name
}

export interface FileReference {
  uri: string; // VS Code file URI
  relativePath: string; // For portability and display
  lines?: LineRange; // Optional: only include specific lines
  overrideContextMode?: ContextMode; // Per-file override
  repositoryMetadata?: RepositoryMetadata; // Repository context for multi-repo awareness
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

  if (ref.repositoryMetadata) {
    if (typeof ref.repositoryMetadata !== 'object') return false;
    // Metadata fields are all optional, just validate that it's an object
  }

  return true;
}

export function createFileReference(
  uri: string,
  relativePath: string,
  overrideContextMode?: ContextMode,
  repositoryMetadata?: RepositoryMetadata
): FileReference {
  return {
    uri,
    relativePath,
    overrideContextMode,
    repositoryMetadata,
  };
}
