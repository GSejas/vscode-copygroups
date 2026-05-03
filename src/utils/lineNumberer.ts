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

/**
 * Add line numbers to multiple chunks of content
 * Each chunk starts at line 1 (scoped numbering)
 * Useful for multi-file outputs where each file has its own line numbers
 */
export function addLineNumbersToChunks(chunks: { header: string; content: string }[]): string {
  return chunks
    .map(chunk => {
      const numberedContent = addLineNumbers(chunk.content);
      return `${chunk.header}\n\n${numberedContent}`;
    })
    .join('\n\n---\n\n');
}
