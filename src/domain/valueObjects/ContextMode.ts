/**
 * ContextMode Value Object
 * Defines how code context is extracted from files
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * CONTEXT MODE REFERENCE — What Each Mode Extracts
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * MODE          │ INCLUDES                              │ OMITS                    │ USE CASE
 * ──────────────┼───────────────────────────────────────┼──────────────────────────┼──────────────────────────────
 * full          │ • 100% of file content                │ Nothing                  │ Complete context, all details
 *               │ • Every line preserved                │                          │ needed for full understanding
 * ──────────────┼───────────────────────────────────────┼──────────────────────────┼──────────────────────────────
 * skeleton      │ • Structure (classes, functions)      │ • Implementation details │ File architecture overview
 *               │ • Imports/exports                     │ • Function bodies        │ For markdown: headers, links
 *               │ • Decorators                          │ • Variable initialization│ For Python: defs + docstrings
 *               │ • Comments  (docstrings)              │ • Prose content          │ ~70% token reduction
 * ──────────────┼───────────────────────────────────────┼──────────────────────────┼──────────────────────────────
 * docstring     │ • Comments (// #  /** etc)            │ • Code implementation    │ Documentation & API surface
 *               │ • Python docstrings                   │ • Logic details          │ Understand intent without code
 *               │ • JSDoc annotations                   │ • Variable values        │ ~80% token reduction
 * ──────────────┼───────────────────────────────────────┼──────────────────────────┼──────────────────────────────
 * headers       │ • First N lines (default 50)          │ • Lines after N          │ File preamble & copyright
 *               │ • Configurable via maxLines           │ • Rest of file           │ Module documentation
 *               │                                       │                          │ License headers
 * ──────────────┼───────────────────────────────────────┼──────────────────────────┼──────────────────────────────
 * head-tail     │ • First N lines (e.g., 10)            │ • Middle section         │ Summary of file structure
 *               │ • Last M lines (e.g., 5)              │ • Implementation         │ Bookend-style preview
 *               │ • "... (X lines omitted) ..."         │                          │ ~50% token reduction
 * ──────────────┼───────────────────────────────────────┼──────────────────────────┼──────────────────────────────
 * smart         │ • Language-specific heuristics        │ • Implementation details │ AI agent determines best fit
 *               │ • Python: main exports + docstrings   │ (varies)                 │ Adaptively chosen based on
 *               │ • TypeScript: public API              │                          │ file type & content patterns
 * ──────────────┴───────────────────────────────────────┴──────────────────────────┴──────────────────────────────
 *
 * LANGUAGE-SPECIFIC NOTES:
 *
 * Markdown Files (skeleton mode):
 *   • Extracts: Headers (#, ##, ###), links [text](url), code fence markers (```), lists (-, *, +)
 *   • Omits: Prose paragraphs, long descriptions, implementation details
 *   • Result: Navigable table of contents structure
 *
 * Python Files (skeleton mode):
 *   • Extracts: class/def declarations, decorators, docstrings
 *   • Omits: Function bodies, variable assignments, implementation logic
 *   • Result: Clear API surface with documentation
 *
 * TypeScript/JavaScript Files (skeleton mode):
 *   • Extracts: import/export, class/interface/type, function declarations, decorators
 *   • Omits: Function implementations, variable initialization, conditionals
 *   • Result: Type definitions and API signatures
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

export type ContextModeType =
  | 'full'
  | 'docstring'
  | 'headers'
  | 'skeleton'
  | 'head-tail'
  | 'smart';

export interface ContextMode {
  type: ContextModeType;
  maxLines?: number;           // For 'headers' mode
  headLines?: number;          // For 'head-tail' mode
  tailLines?: number;          // For 'head-tail' mode
  heuristic?: 'main-exports' | 'public-api'; // For 'smart' mode
}

/**
 * Descriptions of context modes for UI display, logging, and AI agent reference.
 * Helps users and agents understand what each mode extracts vs omits.
 */
export const CONTEXT_MODE_DESCRIPTIONS: Record<ContextModeType, { title: string; description: string; tokenReduction: string; useCase: string }> = {
  full: {
    title: 'Full Content',
    description: 'Extract 100% of file content including all implementation details, comments, and code.',
    tokenReduction: 'None (0%)',
    useCase: 'When you need complete context for understanding all details',
  },
  skeleton: {
    title: 'Skeleton (Structure Only)',
    description: 'Extract file structure: classes, functions, imports, decorators. For markdown: headers, links, lists. Omits implementation, prose, and details.',
    tokenReduction: '~70% reduction',
    useCase: 'File architecture overview without drowning in implementation details',
  },
  docstring: {
    title: 'Documentation & Comments',
    description: 'Extract only comments, docstrings, and documentation. For Python: docstrings and comments. For others: //, /*, #, etc.',
    tokenReduction: '~80% reduction',
    useCase: 'Understand intent and API surface without code implementation',
  },
  headers: {
    title: 'First N Lines',
    description: 'Extract only the first N lines (default 50). Useful for headers, preamble, copyright, module docs.',
    tokenReduction: 'Variable',
    useCase: 'Capture file preamble and module-level documentation',
  },
  'head-tail': {
    title: 'Head and Tail',
    description: 'Extract first N and last M lines with "... (X lines omitted) ..." marker in between.',
    tokenReduction: '~50% reduction',
    useCase: 'Bookend preview of file structure and ending',
  },
  smart: {
    title: 'Smart (Auto-detected)',
    description: 'Language-specific heuristics. Python: main exports + docstrings. TypeScript: public API. JavaScript: exports.',
    tokenReduction: 'Variable',
    useCase: 'Let the system choose the best extraction based on file type',
  },
};

export function validateContextMode(mode: any): mode is ContextMode {
  if (!mode || typeof mode !== 'object') return false;
  if (!mode.type || typeof mode.type !== 'string') return false;

  const validTypes: ContextModeType[] = ['full', 'docstring', 'headers', 'skeleton', 'head-tail', 'smart'];
  if (!validTypes.includes(mode.type)) return false;

  if (mode.type === 'headers' && (!mode.maxLines || typeof mode.maxLines !== 'number' || mode.maxLines <= 0)) {
    return false;
  }

  if (mode.type === 'head-tail' && (
    !mode.headLines || typeof mode.headLines !== 'number' || mode.headLines <= 0 ||
    !mode.tailLines || typeof mode.tailLines !== 'number' || mode.tailLines <= 0
  )) {
    return false;
  }

  return true;
}
