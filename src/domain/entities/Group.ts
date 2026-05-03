/**
 * Group Entity
 * Represents a collection of files with metadata and settings
 */

import { FileReference } from '../valueObjects/FileReference';
import { Tag } from '../valueObjects/Tag';
import { ContextMode } from '../valueObjects/ContextMode';
import { Preprompt } from './Preprompt';

export interface Group {
  id: string;
  name: string;
  description?: string;
  fileReferences: FileReference[];
  preprompt?: Preprompt;
  tags: Tag[];
  isBookmarked: boolean;
  contextMode: ContextMode;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export class GroupEntity implements Group {
  id: string;
  name: string;
  description?: string;
  fileReferences: FileReference[];
  preprompt?: Preprompt;
  tags: Tag[];
  isBookmarked: boolean;
  contextMode: ContextMode;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;

  constructor(data: Partial<Group>) {
    this.id = data.id || `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = data.name || 'Untitled Group';
    this.description = data.description;
    this.fileReferences = data.fileReferences || [];
    this.preprompt = data.preprompt;
    this.tags = data.tags || [];
    this.isBookmarked = data.isBookmarked ?? false;
    this.contextMode = data.contextMode || { type: 'full' };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata;
  }

  addFile(fileRef: FileReference): void {
    if (!this.fileReferences.some(f => f.uri === fileRef.uri)) {
      this.fileReferences.push(fileRef);
      this.touch();
    }
  }

  removeFile(fileUri: string): void {
    const originalLength = this.fileReferences.length;
    this.fileReferences = this.fileReferences.filter(f => f.uri !== fileUri);
    if (this.fileReferences.length !== originalLength) {
      this.touch();
    }
  }

  addTag(tag: Tag): void {
    if (!this.tags.some(t => t.id === tag.id)) {
      this.tags.push(tag);
      this.touch();
    }
  }

  removeTag(tagId: string): void {
    const originalLength = this.tags.length;
    this.tags = this.tags.filter(t => t.id !== tagId);
    if (this.tags.length !== originalLength) {
      this.touch();
    }
  }

  toggleBookmark(): void {
    this.isBookmarked = !this.isBookmarked;
    this.touch();
  }

  setContextMode(mode: ContextMode): void {
    this.contextMode = mode;
    this.touch();
  }

  setPreprompt(preprompt: Preprompt | undefined): void {
    this.preprompt = preprompt;
    this.touch();
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  getFileCount(): number {
    return this.fileReferences.length;
  }

  hasTag(tagName: string): boolean {
    return this.tags.some(t => t.name === tagName);
  }

  hasFile(fileUri: string): boolean {
    return this.fileReferences.some(f => f.uri === fileUri);
  }

  rename(newName: string): void {
    this.name = newName.trim();
    this.touch();
  }

  setDescription(description: string | undefined): void {
    this.description = description;
    this.touch();
  }
}

export function validateGroup(group: any): group is Group {
  if (!group || typeof group !== 'object') return false;
  if (!group.id || typeof group.id !== 'string') return false;
  if (!group.name || typeof group.name !== 'string') return false;
  if (!Array.isArray(group.fileReferences)) return false;
  if (!Array.isArray(group.tags)) return false;
  if (typeof group.isBookmarked !== 'boolean') return false;
  if (!group.contextMode || typeof group.contextMode !== 'object') return false;
  return true;
}
