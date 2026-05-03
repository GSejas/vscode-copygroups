/**
 * IFileContentProvider Interface
 * Contract for reading file content
 */

export interface IFileContentProvider {
  getContent(fileUri: string): Promise<string>;
  fileExists(fileUri: string): Promise<boolean>;
  getRelativePath(fileUri: string): Promise<string>;
  getFileLanguage(fileUri: string): Promise<string | null>;
}
