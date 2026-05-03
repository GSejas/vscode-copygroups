/**
 * CopyHistoryService
 * Business logic for recording, reviewing, and acting on copy history
 */

import * as vscode from 'vscode';
import {
  CopyHistoryEntry,
  CopiedFileSnapshot,
  CopyTrigger,
  createCopyHistoryEntry,
} from '../../domain/entities/CopyHistoryEntry';
import { ContextMode } from '../../domain/valueObjects/ContextMode';
import { Group } from '../../domain/entities/Group';
import { ICopyHistoryRepository } from '../../domain/interfaces/ICopyHistoryRepository';

export interface CopySource {
  id: string;
  name: string;
  contextMode: ContextMode;
  preprompt?: { name?: string };
}

export class CopyHistoryService {
  constructor(private repository: ICopyHistoryRepository) {}

  /**
   * Called by ExportService immediately after a successful copy/export.
   * Returns the saved entry so callers can reference it.
   */
  async record(
    source: CopySource | Group,
    output: string,
    files: CopiedFileSnapshot[],
    trigger: CopyTrigger
  ): Promise<CopyHistoryEntry> {
    const entry = createCopyHistoryEntry(
      source.id,
      source.name,
      output,
      files,
      source.contextMode,
      trigger,
      source.preprompt?.name
    );

    await this.repository.save(entry);
    return entry;
  }

  async getAll(): Promise<CopyHistoryEntry[]> {
    return this.repository.getAll();
  }

  async getByGroup(groupId: string): Promise<CopyHistoryEntry[]> {
    return this.repository.getByGroupId(groupId);
  }

  async getFavourites(): Promise<CopyHistoryEntry[]> {
    return this.repository.getFavourites();
  }

  /**
   * Toggle the favourite flag on a history entry.
   * Favourites are never auto-pruned and survive a "Clear History" action.
   */
  async toggleFavourite(entryId: string): Promise<CopyHistoryEntry> {
    const entry = await this.repository.getById(entryId);
    if (!entry) {
      throw new Error(`History entry ${entryId} not found`);
    }

    entry.isFavourite = !entry.isFavourite;
    await this.repository.update(entry);
    return entry;
  }

  /**
   * Let the user attach a freeform note to a history entry after reviewing it.
   */
  async setNote(entryId: string, note: string | undefined): Promise<CopyHistoryEntry> {
    const entry = await this.repository.getById(entryId);
    if (!entry) {
      throw new Error(`History entry ${entryId} not found`);
    }

    entry.note = note?.trim() || undefined;
    await this.repository.update(entry);
    return entry;
  }

  /**
   * Re-send the recorded output back to the clipboard — no re-extraction needed.
   */
  async recopy(entryId: string): Promise<void> {
    const entry = await this.repository.getById(entryId);
    if (!entry) {
      throw new Error(`History entry ${entryId} not found`);
    }

    await vscode.env.clipboard.writeText(entry.output);
  }

  async delete(entryId: string): Promise<void> {
    await this.repository.delete(entryId);
  }

  /**
   * Wipes non-favourite entries. Favourited entries are preserved.
   */
  async clearHistory(): Promise<void> {
    await this.repository.clear();
  }

  /**
   * How many times has a specific group been copied?
   */
  async getCopyCountForGroup(groupId: string): Promise<number> {
    const entries = await this.repository.getByGroupId(groupId);
    return entries.length;
  }

  /**
   * The most recent copy entry for a group, if any.
   */
  async getLastCopyForGroup(groupId: string): Promise<CopyHistoryEntry | null> {
    const entries = await this.repository.getByGroupId(groupId);
    return entries[0] ?? null;
  }
}
