import { ContextExtractionService } from '../../../src/application/services/ContextExtractionService';
import { IFileContentProvider } from '../../../src/domain/interfaces/IFileContentProvider';

function makeProvider(content: string, language = 'typescript'): IFileContentProvider {
  return {
    getContent: async () => content,
    fileExists: async () => true,
    getRelativePath: async (uri) => uri,
    getFileLanguage: async () => language,
  };
}

const TS_CONTENT = `import { foo } from './foo';
import { bar } from './bar';

export class MyService {
  private value: string;

  constructor(value: string) {
    this.value = value;
  }

  // Returns the stored value
  getValue(): string {
    return this.value;
  }
}

export function helper(x: number): number {
  return x * 2;
}
`;

describe('ContextExtractionService', () => {
  describe('full mode', () => {
    it('returns entire file content', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT));
      const result = await svc.extract('file:///foo.ts', { type: 'full' });
      expect(result).toBe(TS_CONTENT);
    });
  });

  describe('headers mode', () => {
    it('returns the first N lines', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT));
      const result = await svc.extract('file:///foo.ts', { type: 'headers', maxLines: 3 });
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("import { foo } from './foo';");
    });

    it('defaults to 50 lines when maxLines is not set', async () => {
      const content = Array.from({ length: 60 }, (_, i) => `line${i}`).join('\n');
      const svc = new ContextExtractionService(makeProvider(content));
      const result = await svc.extract('file:///foo.ts', { type: 'headers' });
      expect(result.split('\n')).toHaveLength(50);
    });
  });

  describe('skeleton mode', () => {
    it('includes class and function declarations', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT));
      const result = await svc.extract('file:///foo.ts', { type: 'skeleton' });
      expect(result).toContain('export class MyService');
      expect(result).toContain('export function helper');
    });

    it('includes import lines', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT));
      const result = await svc.extract('file:///foo.ts', { type: 'skeleton' });
      expect(result).toContain("import { foo }");
    });

    it('omits private implementation lines', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT));
      const result = await svc.extract('file:///foo.ts', { type: 'skeleton' });
      expect(result).not.toContain('return this.value');
    });
  });

  describe('docstring mode', () => {
    it('includes comment lines', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT));
      const result = await svc.extract('file:///foo.ts', { type: 'docstring' });
      expect(result).toContain('// Returns the stored value');
    });

    it('excludes non-comment implementation lines', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT));
      const result = await svc.extract('file:///foo.ts', { type: 'docstring' });
      expect(result).not.toContain('private value');
    });
  });

  describe('head-tail mode', () => {
    it('includes first N and last M lines with omission marker', async () => {
      const content = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n');
      const svc = new ContextExtractionService(makeProvider(content));
      const result = await svc.extract('file:///foo.ts', { type: 'head-tail', headLines: 3, tailLines: 2 });
      expect(result).toContain('line1');
      expect(result).toContain('line3');
      expect(result).toContain('omitted');
      expect(result).toContain('line19');
      expect(result).toContain('line20');
    });

    it('returns full content when file is smaller than head+tail', async () => {
      const content = 'a\nb\nc';
      const svc = new ContextExtractionService(makeProvider(content));
      const result = await svc.extract('file:///foo.ts', { type: 'head-tail', headLines: 5, tailLines: 5 });
      expect(result).toBe(content);
    });
  });

  describe('smart mode (non-python fallback)', () => {
    it('falls back to skeleton for non-python files', async () => {
      const svc = new ContextExtractionService(makeProvider(TS_CONTENT, 'typescript'));
      const result = await svc.extract('file:///foo.ts', { type: 'smart' });
      expect(result).toContain('export class MyService');
    });
  });

  describe('python-specific extraction', () => {
    const PY_CONTENT = `import os
import sys

class MyClass:
    """Class docstring."""

    def public_method(self):
        """Does something."""
        return 42

    def _private_method(self):
        pass

def standalone_function(x):
    """Standalone function."""
    return x + 1
`;

    it('skeleton mode extracts python class and function defs', async () => {
      const svc = new ContextExtractionService(makeProvider(PY_CONTENT, 'python'));
      const result = await svc.extract('file:///foo.py', { type: 'skeleton' });
      expect(result).toContain('class MyClass');
      expect(result).toContain('def public_method');
    });

    it('docstring mode extracts python docstrings', async () => {
      const svc = new ContextExtractionService(makeProvider(PY_CONTENT, 'python'));
      const result = await svc.extract('file:///foo.py', { type: 'docstring' });
      expect(result).toContain('Class docstring');
    });
  });

  describe('markdown-specific extraction', () => {
    const MD_CONTENT = `# Project Overview

This is a long description that should not appear in skeleton mode.

## Features

- Feature 1 with details here
- Feature 2 with more details
- Feature 3

### Subsection

More content that is not extracted in skeleton mode.

## Links and References

[GitHub Repository](https://github.com/example/repo)
[Documentation](https://docs.example.com)

\`\`\`typescript
// Code example
const x = 42;
\`\`\`

### Implementation Details

This section contains lots of details that should not be included in skeleton mode.
`;

    it('skeleton mode extracts markdown headers', async () => {
      const svc = new ContextExtractionService(makeProvider(MD_CONTENT, 'markdown'));
      const result = await svc.extract('file:///README.md', { type: 'skeleton' });
      expect(result).toContain('# Project Overview');
      expect(result).toContain('## Features');
      expect(result).toContain('### Subsection');
    });

    it('skeleton mode extracts markdown lists', async () => {
      const svc = new ContextExtractionService(makeProvider(MD_CONTENT, 'markdown'));
      const result = await svc.extract('file:///README.md', { type: 'skeleton' });
      expect(result).toContain('- Feature 1');
      expect(result).toContain('- Feature 2');
    });

    it('skeleton mode extracts markdown links', async () => {
      const svc = new ContextExtractionService(makeProvider(MD_CONTENT, 'markdown'));
      const result = await svc.extract('file:///README.md', { type: 'skeleton' });
      expect(result).toContain('[GitHub Repository]');
      expect(result).toContain('[Documentation]');
    });

    it('skeleton mode includes code fence markers', async () => {
      const svc = new ContextExtractionService(makeProvider(MD_CONTENT, 'markdown'));
      const result = await svc.extract('file:///README.md', { type: 'skeleton' });
      expect(result).toContain('```typescript');
    });

    it('skeleton mode omits long prose content', async () => {
      const svc = new ContextExtractionService(makeProvider(MD_CONTENT, 'markdown'));
      const result = await svc.extract('file:///README.md', { type: 'skeleton' });
      expect(result).not.toContain('This is a long description');
      expect(result).not.toContain('This section contains lots');
    });

    it('full mode returns entire markdown content', async () => {
      const svc = new ContextExtractionService(makeProvider(MD_CONTENT, 'markdown'));
      const result = await svc.extract('file:///README.md', { type: 'full' });
      expect(result).toBe(MD_CONTENT);
      expect(result).toContain('This is a long description');
    });
  });
});
