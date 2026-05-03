// Minimal VS Code API mock for unit tests

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export const workspace = {
  fs: {
    stat: jest.fn().mockResolvedValue({ size: 100, type: FileType.File }),
    readDirectory: jest.fn().mockResolvedValue([]),
  },
  workspaceFolders: undefined,
  getWorkspaceFolder: jest.fn(),
};

export const env = {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
};

export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  })),
};

export const Uri = {
  parse: jest.fn((uri: string) => ({
    toString: () => uri,
    fsPath: uri.replace('file://', ''),
    scheme: 'file',
  })),
  joinPath: jest.fn((base: { toString: () => string }, ...segments: string[]) => ({
    toString: () => [base.toString().replace(/\/$/, ''), ...segments].join('/'),
    fsPath: [base.toString().replace('file://', '').replace(/\/$/, ''), ...segments].join('/'),
  })),
  file: jest.fn((path: string) => ({ toString: () => `file://${path}`, fsPath: path })),
};

export class TreeItem {
  label: string;
  collapsibleState?: number;
  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class ThemeIcon {
  constructor(public id: string, public color?: unknown) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class MarkdownString {
  value = '';
  isTrusted = false;
  appendMarkdown(s: string) { this.value += s; return this; }
  appendText(s: string) { this.value += s; return this; }
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(event: T) { this.listeners.forEach(l => l(event)); }
  dispose() {}
}

export const commands = {
  registerCommand: jest.fn((_id: string, _handler: (...args: unknown[]) => unknown) => ({ dispose: jest.fn() })),
  executeCommand: jest.fn(),
};

export const extensions = {
  getExtension: jest.fn(),
};
