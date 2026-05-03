/**
 * GroupRepository
 * Handles persistence of groups to workspace storage
 */

import * as vscode from 'vscode';
import { Group, GroupEntity } from '../../domain/entities/Group';
import { IGroupRepository } from '../../domain/interfaces/IGroupRepository';

export class GroupRepository implements IGroupRepository {
  private groups: Map<string, Group> = new Map();
  private readonly storageKey = 'copygroups.groups';

  constructor(private globalState: vscode.Memento) {}

  async initialize(): Promise<void> {
    try {
      const stored = this.globalState.get<any>(this.storageKey);
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
      console.error('Failed to load groups from storage:', error);
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
  }

  async delete(id: string): Promise<void> {
    this.groups.delete(id);
    await this.persistToStorage();
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
