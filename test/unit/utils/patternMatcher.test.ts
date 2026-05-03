import { PatternMatcher, isBinaryFile } from '../../../src/utils/patternMatcher';

describe('PatternMatcher', () => {
  describe('no patterns (allow all)', () => {
    it('includes any file when both lists are empty', () => {
      const m = new PatternMatcher([], []);
      expect(m.shouldInclude('src/foo.ts')).toBe(true);
      expect(m.shouldInclude('node_modules/pkg/index.js')).toBe(true);
    });
  });

  describe('exclude patterns', () => {
    it('excludes files matching an exclude glob', () => {
      const m = new PatternMatcher([], ['node_modules/**']);
      expect(m.shouldInclude('node_modules/pkg/index.js')).toBe(false);
      expect(m.shouldInclude('src/index.ts')).toBe(true);
    });

    it('excludes log files', () => {
      const m = new PatternMatcher([], ['**/*.log']);
      expect(m.shouldInclude('logs/app.log')).toBe(false);
      expect(m.shouldInclude('src/app.ts')).toBe(true);
    });

    it('excludes multiple patterns independently', () => {
      const m = new PatternMatcher([], ['dist/**', '.git/**', '**/*.log']);
      expect(m.shouldInclude('dist/extension.js')).toBe(false);
      expect(m.shouldInclude('.git/HEAD')).toBe(false);
      expect(m.shouldInclude('out/debug.log')).toBe(false);
      expect(m.shouldInclude('src/main.ts')).toBe(true);
    });

    it('normalises Windows back-slashes before matching', () => {
      const m = new PatternMatcher([], ['node_modules/**']);
      expect(m.shouldInclude('node_modules\\pkg\\index.js')).toBe(false);
    });
  });

  describe('include patterns', () => {
    it('excludes files that do not match any include glob', () => {
      const m = new PatternMatcher(['**/*.ts'], []);
      expect(m.shouldInclude('src/foo.ts')).toBe(true);
      expect(m.shouldInclude('src/foo.js')).toBe(false);
    });

    it('includes if any include pattern matches', () => {
      const m = new PatternMatcher(['**/*.ts', '**/*.py'], []);
      expect(m.shouldInclude('src/foo.py')).toBe(true);
    });
  });

  describe('combined include + exclude', () => {
    it('exclude wins over include', () => {
      const m = new PatternMatcher(['**/*.ts'], ['node_modules/**']);
      expect(m.shouldInclude('node_modules/pkg/types.ts')).toBe(false);
      expect(m.shouldInclude('src/index.ts')).toBe(true);
    });
  });

  describe('isExcluded', () => {
    it('returns true for excluded paths', () => {
      const m = new PatternMatcher([], ['dist/**']);
      expect(m.isExcluded('dist/bundle.js')).toBe(true);
      expect(m.isExcluded('src/index.ts')).toBe(false);
    });
  });
});

describe('isBinaryFile', () => {
  it('detects common binary extensions', () => {
    expect(isBinaryFile('image.png')).toBe(true);
    expect(isBinaryFile('archive.zip')).toBe(true);
    expect(isBinaryFile('program.exe')).toBe(true);
    expect(isBinaryFile('lib.dll')).toBe(true);
    expect(isBinaryFile('data.db')).toBe(true);
    expect(isBinaryFile('module.pyc')).toBe(true);
  });

  it('allows text-based files', () => {
    expect(isBinaryFile('src/main.ts')).toBe(false);
    expect(isBinaryFile('README.md')).toBe(false);
    expect(isBinaryFile('config.json')).toBe(false);
    expect(isBinaryFile('style.css')).toBe(false);
  });

  it('handles files with no extension', () => {
    expect(isBinaryFile('Makefile')).toBe(false);
    expect(isBinaryFile('Dockerfile')).toBe(false);
  });
});
