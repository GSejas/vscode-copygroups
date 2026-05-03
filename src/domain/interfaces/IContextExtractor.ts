/**
 * IContextExtractor Interface
 * Contract for extracting code context
 */

export interface IContextExtractor {
  extract(filePath: string, content: string): Promise<string>;
  canHandle(language: string): boolean;
}
