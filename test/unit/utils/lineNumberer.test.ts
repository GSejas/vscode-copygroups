import { addLineNumbers } from '../../../src/utils/lineNumberer';

describe('addLineNumbers', () => {
  it('returns empty string unchanged', () => {
    expect(addLineNumbers('')).toBe('');
  });

  it('numbers a single line', () => {
    expect(addLineNumbers('hello')).toBe('001: hello');
  });

  it('numbers multiple lines with zero-padded prefix', () => {
    const result = addLineNumbers('a\nb\nc');
    expect(result).toBe('001: a\n002: b\n003: c');
  });

  it('pads to the width of the longest line number', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = addLineNumbers(lines);
    const firstLine = result.split('\n')[0];
    // 100 lines → 3-digit minimum, so "001:"
    expect(firstLine.startsWith('001: ')).toBe(true);
    const lastLine = result.split('\n')[99];
    expect(lastLine.startsWith('100: ')).toBe(true);
  });

  it('preserves empty lines', () => {
    const result = addLineNumbers('a\n\nb');
    const lines = result.split('\n');
    expect(lines[1]).toBe('002: ');
  });
});
