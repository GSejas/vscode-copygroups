/**
 * ConfigRepository
 * Persists copy configuration to VS Code workspace settings
 */

import * as vscode from 'vscode';
import { CopyConfig, DEFAULT_COPY_CONFIG, validateCopyConfig } from '../../domain/valueObjects/CopyConfig';

const CONFIG_KEY = 'copygroups.config';

export class ConfigRepository {
  constructor(private workspaceState: vscode.Memento) {}

  /**
   * Initialize config repository - loads or creates default config
   */
  async initialize(): Promise<void> {
    const existing = await this.get();
    if (!existing) {
      await this.set(DEFAULT_COPY_CONFIG);
    }
  }

  /**
   * Get current copy configuration
   */
  async get(): Promise<CopyConfig> {
    const stored = this.workspaceState.get<Partial<CopyConfig>>(CONFIG_KEY);
    if (!stored) {
      return DEFAULT_COPY_CONFIG;
    }
    return validateCopyConfig(stored);
  }

  /**
   * Update copy configuration (merges with existing)
   */
  async set(config: Partial<CopyConfig>): Promise<void> {
    const current = await this.get();
    const merged = { ...current, ...config };
    const validated = validateCopyConfig(merged);
    this.workspaceState.update(CONFIG_KEY, validated);
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<void> {
    this.workspaceState.update(CONFIG_KEY, DEFAULT_COPY_CONFIG);
  }

  /**
   * Update a single config property
   */
  async updateProperty<K extends keyof CopyConfig>(key: K, value: CopyConfig[K]): Promise<void> {
    const current = await this.get();
    current[key] = value;
    await this.set(current);
  }
}
