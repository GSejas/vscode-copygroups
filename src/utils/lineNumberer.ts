/**
 * Line Numbering Utility
 * Formats content with line numbers for better reference in AI conversations
 */

/**
 * Add line numbers to content
 * Format: "001: line content" (padded to 3 digits by default)
 * Preserves empty lines and structure.
 *
 * Understands the head-tail omission marker produced by ContextExtractionService:
 *   \n... (N lines omitted) ...\n
 * When encountered, the counter jumps by N so tail lines show their real file
 * line numbers instead of sequential numbers from the head.
 */
export function addLineNumbers(content: string, maxDigits = 3): string {
  if (!content) return content;

  const lines = content.split('\n');

  // Calculate total logical lines (real file length) to determine padding width.
  // Each omission marker accounts for N hidden lines plus itself.
  let totalLogical = 0;
  for (const line of lines) {
    const m = line.match(/^\.\.\. \((\d+) lines omitted\) \.\.\.$/);
    totalLogical += m ? parseInt(m[1], 10) : 1;
  }
  const padding = Math.max(maxDigits, String(totalLogical).length);

  let lineNum = 1;
  return lines
    .map(line => {
      const omitMatch = line.match(/^\.\.\. \((\d+) lines omitted\) \.\.\.$/);
      if (omitMatch) {
        // Show the marker with the current counter, then jump past the omitted range.
        const label = String(lineNum).padStart(padding, '0');
        lineNum += parseInt(omitMatch[1], 10);
        return `${label}: ${line}`;
      }
      const label = String(lineNum).padStart(padding, '0');
      lineNum++;
      return `${label}: ${line}`;
    })
    .join('\n');
}

