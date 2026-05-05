/**
 * Preprompt Repository
 * Persists custom preprompts to local file storage
 * Shared across all VS Code instances
 */

import { Preprompt } from '../../domain/entities/Preprompt';
import { LocalFileStorage } from '../storage/LocalFileStorage';

export class PrepromptRepository {
  private storage: LocalFileStorage;
  private customPreprompts: Map<string, Preprompt> = new Map();

  constructor() {
    this.storage = new LocalFileStorage('copygroups-preprompts.json');
  }

  /**
   * Initialize: load custom preprompts from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = this.storage.get<Record<string, any>>('customPreprompts');
      if (stored) {
        this.customPreprompts = new Map(
          Object.entries(stored).map(([id, data]: [string, any]) => [
            id,
            this.deserializePreprompt(data),
          ])
        );
      }
      console.log(
        `[PrepromptRepository] Initialized with ${this.customPreprompts.size} custom preprompts`
      );
    } catch (error) {
      console.warn('[PrepromptRepository] Failed to initialize, starting fresh:', error);
      this.customPreprompts = new Map();
    }
  }

  /**
   * Get all custom preprompts
   */
  getAll(): Preprompt[] {
    return Array.from(this.customPreprompts.values());
  }

  /**
   * Get a specific preprompt by ID
   */
  getById(id: string): Preprompt | undefined {
    return this.customPreprompts.get(id);
  }

  /**
   * Save a new or updated preprompt
   */
  async save(preprompt: Preprompt): Promise<void> {
    this.customPreprompts.set(preprompt.id, preprompt);
    await this.persist();
  }

  /**
   * Delete a preprompt
   */
  async delete(id: string): Promise<void> {
    this.customPreprompts.delete(id);
    await this.persist();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Persist current state to file storage
   */
  private async persist(): Promise<void> {
    try {
      const data: Record<string, any> = {};
      for (const [id, preprompt] of this.customPreprompts) {
        data[id] = this.serializePreprompt(preprompt);
      }
      this.storage.update('customPreprompts', data);
      console.log(`[PrepromptRepository] Persisted ${this.customPreprompts.size} preprompts`);
    } catch (error) {
      console.error('[PrepromptRepository] Failed to persist preprompts:', error);
      throw error;
    }
  }

  /**
   * Convert Preprompt to serializable format
   */
  private serializePreprompt(preprompt: Preprompt): any {
    return {
      id: preprompt.id,
      name: preprompt.name,
      template: preprompt.template,
      mode: preprompt.mode,
      isSystem: preprompt.isSystem,
      createdAt: preprompt.createdAt.toISOString(),
      updatedAt: preprompt.updatedAt.toISOString(),
    };
  }

  /**
   * Deserialize from storage format
   */
  private deserializePreprompt(data: any): Preprompt {
    return {
      id: data.id,
      name: data.name,
      template: data.template,
      mode: data.mode,
      isSystem: data.isSystem || false,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };
  }

  /**
   * Get the path to the storage file
   */
  getStoragePath(): string {
    return this.storage.getStoragePath();
  }
}
