/**
 * Line Numbering Utility
 * Formats content with line numbers for better reference in AI conversations
 */

/**
 * Add line numbers to content
 * Format: "001: line content" (padded to 3 digits by default)
 * Preserves empty lines and structure
 */
export function addLineNumbers(content: string, maxDigits = 3): string {
  if (!content) return content;

  const lines = content.split('\n');
  const numLines = lines.length;

  // Determine padding width
  const padding = Math.max(maxDigits, String(numLines).length);

  return lines
    .map((line, index) => {
      const lineNum = String(index + 1).padStart(padding, '0');
      return `${lineNum}: ${line}`;
    })
    .join('\n');
}

