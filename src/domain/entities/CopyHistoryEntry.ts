/**
 * CopyHistoryEntry Entity
 *
 * Every time the user copies a group to clipboard (or exports),
 * one of these is created and persisted. Users can then review,
 * re-copy, and favorite past copy operations from the History panel.
 */

import { ContextMode } from '../valueObjects/ContextMode';

export type CopyTrigger = 'clipboard' | 'export-markdown' | 'export-json' | 'direct-multi-file' | 'folder-contents';

/**
 * A snapshot of a single file at copy time.
 * Storing what was actually sent lets users review exact output later,
 * even if the source file has since changed.
 */
export interface CopiedFileSnapshot {
  uri: string;
  relativePath: string;
  /** The extracted content that was included in the copy */
  extractedContent: string;
  /** The mode that was applied to this specific file */
  contextMode: ContextMode;
  /** Whether the file was missing/unreadable at copy time */
  error?: string;
  /** Original file size in bytes (undefined for error snapshots) */
  sizeBytes?: number;
}

export interface CopyHistoryEntry {
  id: string;
  /** The group ID that was copied */
  groupId: string;
  /** Snapshot of group name at copy time (group may be renamed/deleted later) */
  groupName: string;
  /** Full rendered output that was placed on the clipboard */
  output: string;
  /** Per-file snapshots */
  files: CopiedFileSnapshot[];
  /** Context mode the group had at copy time */
  contextMode: ContextMode;
  /** Whether a preprompt was included */
  prepromptName?: string;
  trigger: CopyTrigger;
  /** User-applied favourite for the history entry (not the group itself) */
  isFavourite: boolean;
  /** Optional freeform note the user can add after reviewing */
  note?: string;
  copiedAt: Date;
}

export function createCopyHistoryEntry(
  groupId: string,
  groupName: string,
  output: string,
  files: CopiedFileSnapshot[],
  contextMode: ContextMode,
  trigger: CopyTrigger,
  prepromptName?: string
): CopyHistoryEntry {
  return {
    id: `copy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    groupName,
    output,
    files,
    contextMode,
    prepromptName,
    trigger,
    isFavourite: false,
    copiedAt: new Date(),
  };
}
