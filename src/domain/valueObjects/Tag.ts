/**
 * Tag Value Object
 * Used for organizing and filtering groups
 */

export interface Tag {
  id: string;
  name: string;
  color?: string; // Hex color code
}

export function validateTag(tag: any): tag is Tag {
  if (!tag || typeof tag !== 'object') return false;
  if (!tag.id || typeof tag.id !== 'string') return false;
  if (!tag.name || typeof tag.name !== 'string') return false;
  if (tag.name.trim().length === 0) return false;
  if (tag.color && !/^#[0-9A-F]{6}$/i.test(tag.color)) return false;
  return true;
}

export function createTag(name: string, color?: string): Tag {
  return {
    id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    color,
  };
}
