/**
 * PrepromptService
 * Manages preprompt templates
 */

import { Preprompt, createPreprompt, SYSTEM_PREPROMPTS } from '../../domain/entities/Preprompt';

export class PrepromptService {
  private customPreprompts: Map<string, Preprompt> = new Map();

  constructor() {
    // Initialize with system preprompts
    for (const preprompt of Object.values(SYSTEM_PREPROMPTS)) {
      this.customPreprompts.set(preprompt.id, preprompt);
    }
  }

  getAllPreprompts(): Preprompt[] {
    return Array.from(this.customPreprompts.values());
  }

  getPreprompt(id: string): Preprompt | undefined {
    return this.customPreprompts.get(id);
  }

  createPreprompt(name: string, template: string, mode: 'analysis' | 'summary' | 'review' | 'custom' = 'custom'): Preprompt {
    const preprompt = createPreprompt(name, template, mode);
    this.customPreprompts.set(preprompt.id, preprompt);
    return preprompt;
  }

  updatePreprompt(id: string, name: string, template: string): Preprompt {
    const preprompt = this.customPreprompts.get(id);
    if (!preprompt) {
      throw new Error(`Preprompt ${id} not found`);
    }

    preprompt.name = name;
    preprompt.template = template;
    preprompt.updatedAt = new Date();

    this.customPreprompts.set(id, preprompt);
    return preprompt;
  }

  deletePreprompt(id: string): void {
    // Prevent deletion of system preprompts
    const preprompt = this.customPreprompts.get(id);
    if (preprompt && Object.values(SYSTEM_PREPROMPTS).some(sp => sp.id === id)) {
      throw new Error(`Cannot delete system preprompt: ${id}`);
    }

    this.customPreprompts.delete(id);
  }

  getSystemPreprompts(): Preprompt[] {
    return Object.values(SYSTEM_PREPROMPTS);
  }

  searchPreprompts(query: string): Preprompt[] {
    const q = query.toLowerCase();
    return Array.from(this.customPreprompts.values()).filter(
      p => p.name.toLowerCase().includes(q) || p.template.toLowerCase().includes(q)
    );
  }
}
