/**
 * CopyHistoryRepository
 * Persists copy history entries to local file storage (shared across windows)
 */

import { CopyHistoryEntry } from '../../domain/entities/CopyHistoryEntry';
import { ICopyHistoryRepository } from '../../domain/interfaces/ICopyHistoryRepository';
import { LocalFileStorage } from '../storage/LocalFileStorage';

const STORAGE_KEY = 'history';
/** Keep at most this many entries before pruning oldest non-favourites */
const MAX_ENTRIES = 200;

export class CopyHistoryRepository implements ICopyHistoryRepository {
  private entries: Map<string, CopyHistoryEntry> = new Map();
  private readonly storage: LocalFileStorage;

  constructor() {
    this.storage = new LocalFileStorage('copygroups-history.json');
  }

  async initialize(): Promise<void> {
    try {
      const stored = this.storage.get<any[]>(STORAGE_KEY, []) || [];
      for (const raw of stored) {
        const entry: CopyHistoryEntry = {
          ...raw,
          copiedAt: new Date(raw.copiedAt),
        };
        this.entries.set(entry.id, entry);
      }
    } catch (error) {
      console.error('[CopyHistoryRepository] Failed to load history:', error);
    }
  }

  async getAll(): Promise<CopyHistoryEntry[]> {
    return Array.from(this.entries.values()).sort(
      (a, b) => b.copiedAt.getTime() - a.copiedAt.getTime()
    );
  }

  async getById(id: string): Promise<CopyHistoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async getByGroupId(groupId: string): Promise<CopyHistoryEntry[]> {
    return Array.from(this.entries.values())
      .filter(e => e.groupId === groupId)
      .sort((a, b) => b.copiedAt.getTime() - a.copiedAt.getTime());
  }

  async getFavourites(): Promise<CopyHistoryEntry[]> {
    return Array.from(this.entries.values())
      .filter(e => e.isFavourite)
      .sort((a, b) => b.copiedAt.getTime() - a.copiedAt.getTime());
  }

  async save(entry: CopyHistoryEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    this.pruneIfNeeded();
    await this.persist();
  }

  async update(entry: CopyHistoryEntry): Promise<void> {
    if (!this.entries.has(entry.id)) {
      throw new Error(`History entry ${entry.id} not found`);
    }
    this.entries.set(entry.id, entry);
    await this.persist();
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
    await this.persist();
  }

  async clear(): Promise<void> {
    // Keep favourites when clearing
    for (const [id, entry] of this.entries) {
      if (!entry.isFavourite) {
        this.entries.delete(id);
      }
    }
    await this.persist();
  }

  /**
   * When the cap is exceeded, drop the oldest non-favourite entries first.
   */
  private pruneIfNeeded(): void {
    if (this.entries.size <= MAX_ENTRIES) return;

    const sorted = Array.from(this.entries.values())
      .filter(e => !e.isFavourite)
      .sort((a, b) => a.copiedAt.getTime() - b.copiedAt.getTime());

    const excess = this.entries.size - MAX_ENTRIES;
    sorted.slice(0, excess).forEach(e => this.entries.delete(e.id));
  }

  private async persist(): Promise<void> {
    const data = Array.from(this.entries.values()).map(e => ({
      ...e,
      copiedAt: e.copiedAt.toISOString(),
    }));
    this.storage.update(STORAGE_KEY, data);
  }
}
