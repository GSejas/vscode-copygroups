/**
 * Pattern Matcher Utility
 * Provides glob-style pattern matching for file inclusion/exclusion
 */

import * as minimatch from 'minimatch';

export class PatternMatcher {
  private includePatterns: minimatch.Minimatch[];
  private excludePatterns: minimatch.Minimatch[];

  constructor(includeGlobs: string[], excludeGlobs: string[]) {
    this.includePatterns = includeGlobs.map(
      (glob) => new minimatch.Minimatch(glob, { matchBase: true, noglobstar: false })
    );
    this.excludePatterns = excludeGlobs.map(
      (glob) => new minimatch.Minimatch(glob, { matchBase: true, noglobstar: false })
    );
  }

  /**
   * Determines if a file path should be included
   * Returns false if: excluded pattern matches OR (include patterns exist AND none match)
   */
  shouldInclude(filePath: string): boolean {
    // Normalize to forward slashes for consistent matching
    const normalized = filePath.replace(/\\/g, '/');

    // Check exclusions first (deny list)
    for (const pattern of this.excludePatterns) {
      if (pattern.match(normalized)) {
        return false;
      }
    }

    // If no include patterns, default to true (allow all non-excluded)
    if (this.includePatterns.length === 0) {
      return true;
    }

    // Check inclusions (allow list)
    for (const pattern of this.includePatterns) {
      if (pattern.match(normalized)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if path matches any exclude pattern (convenience method)
   */
  isExcluded(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return this.excludePatterns.some((pattern) => pattern.match(normalized));
  }
}

/**
 * BINARY_EXTENSIONS - Common binary file extensions to skip
 */
export const BINARY_EXTENSIONS = new Set([
  // Archives
  'zip',
  'tar',
  'gz',
  'rar',
  '7z',
  // Executables
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  // Images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'svg',
  'ico',
  'webp',
  // Audio/Video
  'mp3',
  'mp4',
  'avi',
  'mkv',
  'wav',
  'flac',
  // Documents (often binary)
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  // Database
  'db',
  'sqlite',
  'sqlite3',
  // Object files
  'o',
  'obj',
  'pyc',
  'class',
  // Others
  'lock',
  'snap',
]);

/**
 * Check if file is likely binary based on extension
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? BINARY_EXTENSIONS.has(ext) : false;
}
