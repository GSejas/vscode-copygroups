/**
 * GroupRepository
 * Handles persistence of groups to workspace storage
 * Supports multi-window state syncing via observer pattern
 */

import * as vscode from 'vscode';
import { Group, GroupEntity } from '../../domain/entities/Group';
import { IGroupRepository } from '../../domain/interfaces/IGroupRepository';
import { BaseObservable, IStateObserver } from '../patterns/Observer';

export interface GroupRepositoryChangeEvent {
  type: 'add' | 'update' | 'delete' | 'refresh';
  groups: Group[];
  timestamp: Date;
}

export class GroupRepository extends BaseObservable<GroupRepositoryChangeEvent> implements IGroupRepository {
  private groups: Map<string, Group> = new Map();
  private readonly storageKey = 'copygroups.groups';
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private lastModified: number = 0;

  constructor(private globalState: vscode.Memento) {
    super();
  }

  async initialize(): Promise<void> {
    try {
      await this.loadFromStorage();
      console.log(`[GroupRepository] Initialized with ${this.groups.size} groups`);
    } catch (error) {
      console.error('Failed to load groups from storage:', error);
    }
  }

  /**
   * Set up file watcher for multi-window state sync
   */
  setupFileWatcher(extensionPath: string): void {
    try {
      const watchPattern = new vscode.RelativePattern(
        vscode.Uri.file(extensionPath),
        'copygroups-groups.json'
      );
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(watchPattern);

      this.fileWatcher.onDidChange(async () => {
        console.log('[GroupRepository] Detected external file change, refreshing...');
        await this.refresh();
      });

      this.fileWatcher.onDidCreate(async () => {
        console.log('[GroupRepository] File created, refreshing...');
        await this.refresh();
      });

      console.log('[GroupRepository] File watcher enabled');
    } catch (err) {
      console.warn('[GroupRepository] Failed to setup file watcher:', err);
    }
  }

  /**
   * Subscribe to group changes (for UI updates)
   */
  subscribe(observer: IStateObserver<GroupRepositoryChangeEvent>): void {
    super.subscribe(observer);
    console.log(`[GroupRepository] Observer subscribed (total: ${this.observers.size})`);
  }

  /**
   * Unsubscribe from group changes
   */
  unsubscribe(observer: IStateObserver<GroupRepositoryChangeEvent>): void {
    super.unsubscribe(observer);
    console.log(`[GroupRepository] Observer unsubscribed (total: ${this.observers.size})`);
  }

  /**
   * Reload groups from storage (called on external changes)
   */
  async refresh(): Promise<void> {
    try {
      const previousSize = this.groups.size;
      await this.loadFromStorage();

      // Notify observers of the refresh
      this.notifyObservers({
        type: 'refresh',
        groups: Array.from(this.groups.values()),
        timestamp: new Date(),
      });

      if (this.groups.size !== previousSize) {
        console.log(
          `[GroupRepository] Refreshed: ${previousSize} → ${this.groups.size} groups`
        );
      }
    } catch (error) {
      console.error('[GroupRepository] Failed to refresh from storage:', error);
    }
  }

  async getById(id: string): Promise<Group | null> {
    return this.groups.get(id) || null;
  }

  async getAll(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  async save(group: Group): Promise<void> {
    this.groups.set(group.id, group);
    await this.persistToStorage();

    // Notify observers
    this.notifyObservers({
      type: 'update',
      groups: Array.from(this.groups.values()),
      timestamp: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    this.groups.delete(id);
    await this.persistToStorage();

    // Notify observers
    this.notifyObservers({
      type: 'delete',
      groups: Array.from(this.groups.values()),
      timestamp: new Date(),
    });
  }

  async findByTag(tagName: string): Promise<Group[]> {
    return Array.from(this.groups.values()).filter(g =>
      g.tags.some(t => t.name === tagName)
    );
  }

  async search(query: string): Promise<Group[]> {
    const q = query.toLowerCase();
    return Array.from(this.groups.values()).filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.description?.toLowerCase().includes(q) ||
      g.tags.some(t => t.name.toLowerCase().includes(q))
    );
  }

  /**
   * Dispose resources (called on extension deactivate)
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Load groups from globalState storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = this.globalState.get<any>(this.storageKey);
      this.groups.clear();

      if (stored && Array.isArray(stored)) {
        for (const groupData of stored) {
          // Reconstruct dates from ISO strings
          if (groupData.createdAt) {
            groupData.createdAt = new Date(groupData.createdAt);
          }
          if (groupData.updatedAt) {
            groupData.updatedAt = new Date(groupData.updatedAt);
          }

          const group = new GroupEntity(groupData);
          this.groups.set(group.id, group);
        }
      }
    } catch (error) {
      console.error('[GroupRepository] Failed to load from storage:', error);
    }
  }

  private async persistToStorage(): Promise<void> {
    try {
      const data = Array.from(this.groups.values()).map(group => ({
        ...group,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      }));

      await this.globalState.update(this.storageKey, data);
    } catch (error) {
      console.error('Failed to persist groups to storage:', error);
      throw error;
    }
  }
}
