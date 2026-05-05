/**
 * Preprompt Service
 * Business logic for preprompts - combines system and custom preprompts
 */

import { Preprompt, SYSTEM_PREPROMPTS } from '../../domain/entities/Preprompt';
import { PrepromptRepository } from '../repositories/PrepromptRepository';
import { randomUUID } from 'crypto';

export class PrepromptService {
  private systemPreprompts: Preprompt[];

  constructor(
    private prepromptRepository: PrepromptRepository,
    systemPreprompts?: Preprompt[]
  ) {
    // Convert SYSTEM_PREPROMPTS Record to array
    this.systemPreprompts = systemPreprompts || Object.values(SYSTEM_PREPROMPTS);
  }

  /**
   * Get all preprompts (system + custom)
   */
  getAllPreprompts(): Preprompt[] {
    const custom = this.prepromptRepository.getAll();
    return [...this.systemPreprompts, ...custom];
  }

  /**
   * Get only system preprompts
   */
  getSystemPreprompts(): Preprompt[] {
    return this.systemPreprompts;
  }

  /**
   * Get only custom preprompts
   */
  getCustomPreprompts(): Preprompt[] {
    return this.prepromptRepository.getAll();
  }

  /**
   * Create a new custom preprompt
   */
  async create(name: string, template: string, mode: string): Promise<Preprompt> {
    const id = randomUUID();
    const now = new Date();

    const preprompt: Preprompt = {
      id,
      name,
      template,
      mode: mode as any,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.prepromptRepository.save(preprompt);
    return preprompt;
  }

  /**
   * Update an existing custom preprompt
   */
  async update(id: string, name: string, template: string, mode: string): Promise<Preprompt> {
    const existing = this.prepromptRepository.getById(id);
    if (!existing) {
      throw new Error(`Preprompt not found: ${id}`);
    }

    const updated: Preprompt = {
      ...existing,
      name,
      template,
      mode: mode as any,
      updatedAt: new Date(),
    };

    await this.prepromptRepository.save(updated);
    return updated;
  }

  /**
   * Delete a custom preprompt
   */
  async delete(id: string): Promise<void> {
    // Prevent deletion of system preprompts
    const existing = this.prepromptRepository.getById(id);
    if (!existing) {
      throw new Error(`Preprompt not found: ${id}`);
    }
    if (existing.isSystem) {
      throw new Error(`Cannot delete system preprompt: ${id}`);
    }

    await this.prepromptRepository.delete(id);
  }

  /**
   * Get a preprompt by ID (from either system or custom)
   */
  getById(id: string): Preprompt | undefined {
    // Check system first
    const system = this.systemPreprompts.find((p) => p.id === id);
    if (system) {
      return system;
    }

    // Then check custom
    return this.prepromptRepository.getById(id);
  }
}
