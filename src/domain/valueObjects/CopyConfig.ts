/**
 * CopyConfig Value Object
 * Defines performance limits, context mode defaults, and file filtering rules
 */

export interface CopyConfig {
  // Default context mode for new copy operations
  defaultContextMode: string;

  // Language-specific context mode overrides (e.g., { markdown: 'skeleton', python: 'skeleton', robot: 'skeleton' })
  languageOverrides: Record<string, string>;

  // Performance limits
  maxFileCount: number;          // Stop adding files after this count
  maxTotalSizeBytes: number;     // Stop reading file content after this total
  maxFileSizeBytes: number;      // Skip individual files larger than this
  maxDirectoryDepth: number;     // Max recursion depth when scanning folders

  // Pattern matching
  includePatterns: string[];     // Glob patterns to include (e.g., ["**/*.ts", "**/*.py"])
  excludePatterns: string[];     // Glob patterns to exclude (e.g., ["node_modules/**", ".git/**"])

  // UI/UX preferences
  skipBinaryFiles: boolean;       // Automatically skip .exe, .png, .bin, etc.
  addLineNumbers: boolean;        // Prepend line numbers to extracted code (e.g., "001: ")

  // Project tree
  includeFileTree: boolean;       // Prepend an ASCII project tree to the copied output
  fileTreeDepth: number;          // How many directory levels to show in the tree

  // Neighbor files
  includeNeighborFiles: boolean;  // Append sibling files (not copied) per directory
  neighborFileMode: 'names' | 'content'; // 'names' = list only; 'content' = include extracted code
}

export const DEFAULT_COPY_CONFIG: CopyConfig = {
  defaultContextMode: 'full',
  languageOverrides: {
    markdown: 'skeleton',
    python: 'skeleton',
    robot: 'skeleton',
    robotfile: 'skeleton',
  },
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
  skipBinaryFiles: true,
  addLineNumbers: true,
  includeFileTree: false,
  fileTreeDepth: 3,
  includeNeighborFiles: false,
  neighborFileMode: 'names',
};

/**
 * Validates and clamps config values to safe ranges
 */
export function validateCopyConfig(config: Partial<CopyConfig>): CopyConfig {
  const defaults = DEFAULT_COPY_CONFIG;
  return {
    defaultContextMode: config.defaultContextMode || defaults.defaultContextMode,
    languageOverrides: config.languageOverrides || defaults.languageOverrides,
    maxFileCount: Math.max(1, config.maxFileCount || defaults.maxFileCount),
    maxTotalSizeBytes: Math.max(1024, config.maxTotalSizeBytes || defaults.maxTotalSizeBytes),
    maxFileSizeBytes: Math.max(1024, config.maxFileSizeBytes || defaults.maxFileSizeBytes),
    maxDirectoryDepth: Math.max(1, config.maxDirectoryDepth || defaults.maxDirectoryDepth),
    includePatterns: config.includePatterns || defaults.includePatterns,
    excludePatterns: config.excludePatterns || defaults.excludePatterns,
    skipBinaryFiles: config.skipBinaryFiles !== undefined ? config.skipBinaryFiles : defaults.skipBinaryFiles,
    addLineNumbers: config.addLineNumbers !== undefined ? config.addLineNumbers : defaults.addLineNumbers,
    includeFileTree: config.includeFileTree !== undefined ? config.includeFileTree : defaults.includeFileTree,
    fileTreeDepth: Math.min(10, Math.max(1, config.fileTreeDepth || defaults.fileTreeDepth)),
    includeNeighborFiles: config.includeNeighborFiles !== undefined ? config.includeNeighborFiles : defaults.includeNeighborFiles,
    neighborFileMode: config.neighborFileMode || defaults.neighborFileMode,
  };
}
