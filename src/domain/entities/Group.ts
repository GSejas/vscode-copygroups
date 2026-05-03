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
