/**
 * Local File Storage Provider
 * Provides persistent file-based storage outside VS Code state system
 * Allows sharing data across all VS Code instances on the local machine
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface StorageData {
  version: number;
  lastModified: string;
  data: Record<string, any>;
}

export class LocalFileStorage {
  private storagePath: string;

  constructor(filename: string = 'copygroups-data.json') {
    // Store in ~/.vscode-copygroups/ directory for all instances to access
    const userDataDir = path.join(os.homedir(), '.vscode-copygroups');
    this.storagePath = path.join(userDataDir, filename);
    
    // Ensure directory exists
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
  }

  /**
   * Get data from local storage file
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const content = this.readFile();
      if (content && content.data && content.data[key] !== undefined) {
        return content.data[key] as T;
      }
      return defaultValue;
    } catch (error) {
      console.warn(`[LocalFileStorage] Failed to read key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set data in local storage file
   */
  update(key: string, value: any): void {
    try {
      const content = this.readFile() || this.createEmpty();
      content.data[key] = value;
      content.lastModified = new Date().toISOString();
      this.writeFile(content);
    } catch (error) {
      console.error(`[LocalFileStorage] Failed to write key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Remove a key from storage
   */
  delete(key: string): void {
    try {
      const content = this.readFile();
      if (content && content.data) {
        delete content.data[key];
        content.lastModified = new Date().toISOString();
        this.writeFile(content);
      }
    } catch (error) {
      console.error(`[LocalFileStorage] Failed to delete key "${key}":`, error);
      throw error;
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    try {
      this.writeFile(this.createEmpty());
    } catch (error) {
      console.error('[LocalFileStorage] Failed to clear storage:', error);
      throw error;
    }
  }

  /**
   * Get storage file path (for testing/debugging)
   */
  getStoragePath(): string {
    return this.storagePath;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private readFile(): StorageData | null {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return null;
      }
      const rawData = fs.readFileSync(this.storagePath, 'utf-8');
      return JSON.parse(rawData) as StorageData;
    } catch (error) {
      console.error('[LocalFileStorage] Failed to read storage file:', error);
      return null;
    }
  }

  private writeFile(content: StorageData): void {
    try {
      const json = JSON.stringify(content, null, 2);
      fs.writeFileSync(this.storagePath, json, 'utf-8');
    } catch (error) {
      console.error('[LocalFileStorage] Failed to write storage file:', error);
      throw error;
    }
  }

  private createEmpty(): StorageData {
    return {
      version: 1,
      lastModified: new Date().toISOString(),
      data: {},
    };
  }
}
