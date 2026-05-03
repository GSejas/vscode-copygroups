/**
 * ICopyHistoryRepository
 * Contract for copy history persistence
 */

import { CopyHistoryEntry } from '../entities/CopyHistoryEntry';

export interface ICopyHistoryRepository {
  getAll(): Promise<CopyHistoryEntry[]>;
  getById(id: string): Promise<CopyHistoryEntry | null>;
  getByGroupId(groupId: string): Promise<CopyHistoryEntry[]>;
  getFavourites(): Promise<CopyHistoryEntry[]>;
  save(entry: CopyHistoryEntry): Promise<void>;
  update(entry: CopyHistoryEntry): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}
