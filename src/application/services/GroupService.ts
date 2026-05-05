/**
 * GroupService
 * Orchestrates group management operations
 */

import { GroupEntity, Group } from '../../domain/entities/Group';
import { IGroupRepository } from '../../domain/interfaces/IGroupRepository';
import { createFileReference, RepositoryMetadata } from '../../domain/valueObjects/FileReference';
import { Tag } from '../../domain/valueObjects/Tag';
import { ContextMode } from '../../domain/valueObjects/ContextMode';
import { Preprompt } from '../../domain/entities/Preprompt';

export class GroupService {
  constructor(private repository: IGroupRepository) {}

  async createGroup(name: string, description?: string): Promise<Group> {
    const group = new GroupEntity({
      name: name.trim(),
      description: description?.trim(),
    });

    await this.repository.save(group);
    return group;
  }

  async getGroup(groupId: string): Promise<Group | null> {
    return this.repository.getById(groupId);
  }

  async getAllGroups(): Promise<Group[]> {
    return this.repository.getAll();
  }

  async updateGroup(group: Group): Promise<void> {
    await this.repository.save(group);
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.repository.delete(groupId);
  }

  async addFileToGroup(groupId: string, fileUri: string, relativePath: string, repositoryMetadata?: RepositoryMetadata): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    if (!group.fileReferences.some(f => f.uri === fileUri)) {
      const fileRef = createFileReference(fileUri, relativePath, undefined, repositoryMetadata);

      group.fileReferences.push(fileRef);
      group.updatedAt = new Date();

      await this.repository.save(group);
    }

    return group;
  }

  async removeFileFromGroup(groupId: string, fileUri: string): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const originalLength = group.fileReferences.length;
    group.fileReferences = group.fileReferences.filter(f => f.uri !== fileUri);

    if (group.fileReferences.length !== originalLength) {
      group.updatedAt = new Date();
      await this.repository.save(group);
    }

    return group;
  }

  async addTagToGroup(groupId: string, tag: Tag): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    if (!group.tags.some(t => t.id === tag.id)) {
      group.tags.push(tag);
      group.updatedAt = new Date();
      await this.repository.save(group);
    }

    return group;
  }

  async removeTagFromGroup(groupId: string, tagId: string): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    const originalLength = group.tags.length;
    group.tags = group.tags.filter(t => t.id !== tagId);

    if (group.tags.length !== originalLength) {
      group.updatedAt = new Date();
      await this.repository.save(group);
    }

    return group;
  }

  async toggleBookmark(groupId: string): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    group.isBookmarked = !group.isBookmarked;
    group.updatedAt = new Date();

    await this.repository.save(group);
    return group;
  }

  async setContextMode(groupId: string, mode: ContextMode): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    group.contextMode = mode;
    group.updatedAt = new Date();

    await this.repository.save(group);
    return group;
  }

  async setPreprompt(groupId: string, preprompt: Preprompt | undefined): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    group.preprompt = preprompt;
    group.updatedAt = new Date();

    await this.repository.save(group);
    return group;
  }

  async getBookmarkedGroups(): Promise<Group[]> {
    const allGroups = await this.repository.getAll();
    return allGroups.filter(g => g.isBookmarked).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getRecentGroups(limit = 5): Promise<Group[]> {
    const allGroups = await this.repository.getAll();
    return allGroups
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async searchGroups(query: string): Promise<Group[]> {
    return this.repository.search(query);
  }

  async getGroupsByTag(tagName: string): Promise<Group[]> {
    return this.repository.findByTag(tagName);
  }

  async renameGroup(groupId: string, newName: string): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    group.name = newName.trim();
    group.updatedAt = new Date();

    await this.repository.save(group);
    return group;
  }

  async setDescription(groupId: string, description: string | undefined): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    group.description = description?.trim();
    group.updatedAt = new Date();

    await this.repository.save(group);
    return group;
  }

  /**
   * Set the context mode for a specific file in the group
   */
  async setFileMode(groupId: string, fileIndex: number, mode: ContextMode): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    if (fileIndex < 0 || fileIndex >= group.fileReferences.length) {
      throw new Error(`Invalid file index: ${fileIndex}`);
    }

    group.fileReferences[fileIndex].overrideContextMode = mode;
    group.updatedAt = new Date();

    await this.repository.save(group);
    return group;
  }

  /**
   * Remove a file from the group by index
   */
  async removeFileByIndex(groupId: string, fileIndex: number): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    if (fileIndex < 0 || fileIndex >= group.fileReferences.length) {
      throw new Error(`Invalid file index: ${fileIndex}`);
    }

    group.fileReferences.splice(fileIndex, 1);
    group.updatedAt = new Date();

    await this.repository.save(group);
    return group;
  }
}
