/**
 * ContextExtractionService
 * Main service for extracting code context with different modes
 * Prioritizes Python processing but supports all languages
 */

import { ContextMode } from '../../domain/valueObjects/ContextMode';
import { IFileContentProvider } from '../../domain/interfaces/IFileContentProvider';
import { PythonContextExtractor } from '../extractors/PythonContextExtractor';
import { error } from '../../utils/logger';

export class ContextExtractionService {
  private pythonExtractor: PythonContextExtractor;

  constructor(private fileProvider: IFileContentProvider) {
    this.pythonExtractor = new PythonContextExtractor();
  }

  async extract(fileUri: string, mode: ContextMode): Promise<string> {
    try {
      const content = await this.fileProvider.getContent(fileUri);
      const language = await this.fileProvider.getFileLanguage(fileUri);

      switch (mode.type) {
        case 'full':
          return content;

        case 'docstring':
          return this.extractDocstrings(content, language);

        case 'headers':
          return this.extractHeaders(content, mode.maxLines || 50);

        case 'skeleton':
          return this.extractSkeleton(content, language);

        case 'head-tail':
          return this.extractHeadTail(content, mode.headLines || 10, mode.tailLines || 5);

        case 'smart':
          return this.extractSmartContext(content, language, mode.heuristic);

        default:
          return content;
      }
    } catch (err) {
      error(`Failed to extract context from ${fileUri}`, err);
      throw err;
    }
  }

  private extractDocstrings(content: string, language: string | null): string {
    if (language === 'python') {
      return this.pythonExtractor.extractDocstrings(content);
    }

    // Generic docstring extraction for other languages
    return this.genericExtractDocstrings(content);
  }

  private genericExtractDocstrings(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Match various comment styles
      if (
        trimmed.startsWith('//') ||   // JavaScript, Java, Go, Rust
        trimmed.startsWith('#') ||    // Python, Shell
        trimmed.startsWith('--') ||   // SQL, Lua
        trimmed.startsWith('/*') ||   // C-style block comments
        trimmed.startsWith('*') ||
        trimmed.startsWith('"""') ||  // Python
        trimmed.startsWith("'''") ||  // Python
        trimmed.startsWith('/**')     // JavaDoc
      ) {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  private extractHeaders(content: string, maxLines: number): string {
    const lines = content.split('\n');
    return lines.slice(0, maxLines).join('\n');
  }

  private extractSkeleton(content: string, language: string | null): string {
    if (language === 'python') {
      return this.pythonExtractor.extractSkeleton(content);
    }

    if (language === 'markdown') {
      return this.genericExtractMarkdownSkeleton(content);
    }

    // Generic skeleton extraction using regex
    return this.genericExtractSkeleton(content);
  }

  private genericExtractMarkdownSkeleton(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Match markdown headers (# ## ### etc)
      if (trimmed.startsWith('#')) {
        result.push(line);
        continue;
      }

      // Match markdown links [text](url)
      if (trimmed.includes('[') && trimmed.includes(']')) {
        result.push(line);
        continue;
      }

      // Match code fence markers
      if (trimmed.startsWith('```')) {
        result.push(line);
        continue;
      }

      // Match list items
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('+') || /^\d+\./.test(trimmed)) {
        result.push(line);
        continue;
      }
    }

    return result.join('\n');
  }

  private genericExtractSkeleton(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    // Match class definitions
    const classRegex = /^\s*(export\s+)?(abstract\s+)?(class|interface|struct|enum|type)\s+\w+/;
    // Match function definitions
    const funcRegex = /^\s*(export\s+)?(async\s+)?(public|private|protected|static\s+)*(function|const|let|var)\s+\w+\s*\(/;
    // Match decorators
    const decoratorRegex = /^\s*(@|#\[)/;
    // Match imports
    const importRegex = /^\s*(import|from|include|require)/;

    for (const line of lines) {
      if (
        classRegex.test(line) ||
        funcRegex.test(line) ||
        decoratorRegex.test(line) ||
        importRegex.test(line)
      ) {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  private extractHeadTail(content: string, headLines: number, tailLines: number): string {
    const lines = content.split('\n');
    const totalLines = lines.length;

    if (totalLines <= headLines + tailLines) {
      // If file is small, return all
      return content;
    }

    const head = lines.slice(0, headLines);
    const tail = lines.slice(-tailLines);
    const omittedCount = totalLines - headLines - tailLines;

    return [...head, `... (${omittedCount} lines omitted) ...`, ...tail].join('\n');
  }

  private extractSmartContext(content: string, language: string | null, heuristic?: string): string {
    if (language === 'python') {
      if (heuristic === 'public-api') {
        return this.pythonExtractor.extractPublicAPI(content);
      } else if (heuristic === 'main-exports') {
        return this.pythonExtractor.extractMainExports(content);
      }
      return this.pythonExtractor.extractSkeleton(content);
    }

    // Fall back to skeleton for other languages
    return this.extractSkeleton(content, language);
  }

  /**
   * Estimate content size without extracting
   */
  estimateExtractedSize(content: string, mode: ContextMode): number {
    switch (mode.type) {
      case 'full':
        return content.length;
      case 'docstring':
        return this.genericExtractDocstrings(content).length;
      case 'headers':
        return this.extractHeaders(content, mode.maxLines || 50).length;
      case 'skeleton':
        return this.genericExtractSkeleton(content).length;
      case 'head-tail':
        return this.extractHeadTail(content, mode.headLines || 10, mode.tailLines || 5).length;
      default:
        return content.length;
    }
  }
}
