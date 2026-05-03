/**
 * CopyConfig Value Object
 * Defines performance limits, context mode defaults, and file filtering rules
 */

export interface CopyConfig {
  // Default context mode for new copy operations
  defaultContextMode: string;

  // Performance limits
  maxFileCount: number;          // Stop adding files after this count
  maxTotalSizeBytes: number;     // Stop reading file content after this total
  maxFileSizeBytes: number;      // Skip individual files larger than this
  maxDirectoryDepth: number;     // Max recursion depth when scanning folders

  // Pattern matching
  includePatterns: string[];     // Glob patterns to include (e.g., ["**/*.ts", "**/*.py"])
  excludePatterns: string[];     // Glob patterns to exclude (e.g., ["node_modules/**", ".git/**"])

  // UI/UX preferences
  showPreviewTree: boolean;       // Show expandable tree before confirming copy
  autoFavoriteSize: number;       // Entries with < N files auto-marked favorite
  skipBinaryFiles: boolean;       // Automatically skip .exe, .png, .bin, etc.
}

export const DEFAULT_COPY_CONFIG: CopyConfig = {
  defaultContextMode: 'skeleton',
  maxFileCount: 100,
  maxTotalSizeBytes: 5 * 1024 * 1024,        // 5 MB
  maxFileSizeBytes: 1024 * 1024,             // 1 MB per file
  maxDirectoryDepth: 10,
  includePatterns: [],                        // Empty = include all
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '.vscode/**',
    '**/.DS_Store',
    '**/*.log',
  ],
  showPreviewTree: true,
  autoFavoriteSize: 5,
  skipBinaryFiles: true,
};

/**
 * Validates and clamps config values to safe ranges
 */
export function validateCopyConfig(config: Partial<CopyConfig>): CopyConfig {
  const defaults = DEFAULT_COPY_CONFIG;
  return {
    defaultContextMode: config.defaultContextMode || defaults.defaultContextMode,
    maxFileCount: Math.max(1, config.maxFileCount || defaults.maxFileCount),
    maxTotalSizeBytes: Math.max(1024, config.maxTotalSizeBytes || defaults.maxTotalSizeBytes),
    maxFileSizeBytes: Math.max(1024, config.maxFileSizeBytes || defaults.maxFileSizeBytes),
    maxDirectoryDepth: Math.max(1, config.maxDirectoryDepth || defaults.maxDirectoryDepth),
    includePatterns: config.includePatterns || defaults.includePatterns,
    excludePatterns: config.excludePatterns || defaults.excludePatterns,
    showPreviewTree: config.showPreviewTree !== undefined ? config.showPreviewTree : defaults.showPreviewTree,
    autoFavoriteSize: Math.max(0, config.autoFavoriteSize || defaults.autoFavoriteSize),
    skipBinaryFiles: config.skipBinaryFiles !== undefined ? config.skipBinaryFiles : defaults.skipBinaryFiles,
  };
}
