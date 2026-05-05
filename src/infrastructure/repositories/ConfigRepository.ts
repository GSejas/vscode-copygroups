/**
 * ConfigRepository
 * Persists copy configuration to VS Code workspace settings
 * Supports multi-window state syncing via observer pattern
 */

import * as vscode from 'vscode';
import { CopyConfig, DEFAULT_COPY_CONFIG, validateCopyConfig } from '../../domain/valueObjects/CopyConfig';
import { BaseObservable, IStateObserver } from '../patterns/Observer';

const CONFIG_KEY = 'copygroups.config';

export interface ConfigRepositoryChangeEvent {
  type: 'update' | 'reset';
  config: CopyConfig;
  timestamp: Date;
}

export class ConfigRepository extends BaseObservable<ConfigRepositoryChangeEvent> {
  constructor(private globalState: vscode.Memento) {
    super();
  }

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
   * Subscribe to config changes (for UI updates)
   */
  subscribe(observer: IStateObserver<ConfigRepositoryChangeEvent>): void {
    super.subscribe(observer);
    console.log(`[ConfigRepository] Observer subscribed (total: ${this.observers.size})`);
  }

  /**
   * Unsubscribe from config changes
   */
  unsubscribe(observer: IStateObserver<ConfigRepositoryChangeEvent>): void {
    super.unsubscribe(observer);
    console.log(`[ConfigRepository] Observer unsubscribed (total: ${this.observers.size})`);
  }

  /**
   * Get current copy configuration.
   * VS Code workspace settings (copygroups.*) take precedence over stored state.
   */
  async get(): Promise<CopyConfig> {
    const stored = this.globalState.get<Partial<CopyConfig>>(CONFIG_KEY) || {};
    const ws = vscode.workspace.getConfiguration('copygroups');
    const fromSettings: Partial<CopyConfig> = {};
    const keys: (keyof CopyConfig)[] = [
      'defaultContextMode', 'maxFileCount', 'maxTotalSizeBytes', 'maxFileSizeBytes',
      'maxDirectoryDepth', 'includePatterns', 'excludePatterns', 'skipBinaryFiles',
      'addLineNumbers', 'includeFileTree', 'fileTreeDepth', 'includeNeighborFiles',
      'neighborFileMode',
    ];
    for (const key of keys) {
      const val = ws.get(key);
      if (val !== undefined) {
        (fromSettings as Record<string, unknown>)[key] = val;
      }
    }
    return validateCopyConfig({ ...stored, ...fromSettings });
  }

  /**
   * Update copy configuration (merges with existing)
   */
  async set(config: Partial<CopyConfig>): Promise<void> {
    const current = await this.get();
    const merged = { ...current, ...config };
    const validated = validateCopyConfig(merged);
    await this.globalState.update(CONFIG_KEY, validated);

    // Notify observers
    this.notifyObservers({
      type: 'update',
      config: validated,
      timestamp: new Date(),
    });
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<void> {
    await this.globalState.update(CONFIG_KEY, DEFAULT_COPY_CONFIG);

    // Notify observers
    this.notifyObservers({
      type: 'reset',
      config: DEFAULT_COPY_CONFIG,
      timestamp: new Date(),
    });
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
