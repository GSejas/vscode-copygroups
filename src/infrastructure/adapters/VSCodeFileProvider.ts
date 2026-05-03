/**
 * VSCodeFileProvider
 * Adapts VS Code API for file operations
 */

import * as vscode from 'vscode';
import { IFileContentProvider } from '../../domain/interfaces/IFileContentProvider';

export class VSCodeFileProvider implements IFileContentProvider {
  async getContent(fileUri: string): Promise<string> {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const bytes = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(bytes);
    } catch (error) {
      throw new Error(`Cannot read file: ${fileUri}`);
    }
  }

  async fileExists(fileUri: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.parse(fileUri);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async getRelativePath(fileUri: string): Promise<string> {
    const uri = vscode.Uri.parse(fileUri);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return uri.fsPath;
    }

    const relative = vscode.workspace.asRelativePath(uri);
    return relative;
  }

  async getFileLanguage(fileUri: string): Promise<string | null> {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const document = await vscode.workspace.openTextDocument(uri);
      return document.languageId;
    } catch {
      // Try to infer from file extension
      const ext = fileUri.split('.').pop()?.toLowerCase();
      if (ext === 'py') return 'python';
      if (ext === 'js') return 'javascript';
      if (ext === 'ts') return 'typescript';
      if (ext === 'java') return 'java';
      if (ext === 'go') return 'go';
      if (ext === 'rs') return 'rust';
      if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') return 'cpp';
      if (ext === 'c') return 'c';
      if (ext === 'cs') return 'csharp';
      if (ext === 'rb') return 'ruby';
      if (ext === 'php') return 'php';
      if (ext === 'swift') return 'swift';
      if (ext === 'kt') return 'kotlin';
      if (ext === 'scala') return 'scala';
      if (ext === 'sql') return 'sql';
      if (ext === 'sh' || ext === 'bash') return 'shell';
      return null;
    }
  }
}
