/**
 * IGroupRepository Interface
 * Contract for group persistence
 */

import { Group } from '../entities/Group';

export interface IGroupRepository {
  getById(id: string): Promise<Group | null>;
  getAll(): Promise<Group[]>;
  save(group: Group): Promise<void>;
  delete(id: string): Promise<void>;
  findByTag(tagName: string): Promise<Group[]>;
  search(query: string): Promise<Group[]>;
}
