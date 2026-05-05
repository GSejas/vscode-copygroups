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

  it('jumps counter past omitted lines so tail shows real file line numbers', () => {
    // Simulates head-tail output: 3 head lines, 10 omitted, 2 tail lines (no surrounding blank lines)
    const content = 'line1\nline2\nline3\n... (10 lines omitted) ...\nline14\nline15';
    const result = addLineNumbers(content);
    const lines = result.split('\n');

    expect(lines[0]).toMatch(/^001: line1$/);
    expect(lines[2]).toMatch(/^003: line3$/);
    // marker is at line 4 in the file (first omitted line position)
    expect(lines[3]).toMatch(/^004: \.\.\. \(10 lines omitted\) \.\.\.$/);
    // tail lines jump to 014 and 015 (004 + 10 = 014)
    expect(lines[4]).toMatch(/^014: line14$/);
    expect(lines[5]).toMatch(/^015: line15$/);
  });

  it('pads wide enough to fit real tail line numbers', () => {
    // 5 head + 995 omitted + 2 tail = file has 1002 lines → needs 4-digit padding
    const tail = 'last1\nlast2';
    const content = Array.from({ length: 5 }, (_, i) => `h${i}`).join('\n')
      + '\n... (995 lines omitted) ...\n' + tail;
    const result = addLineNumbers(content);
    // tail lines: marker at line 6 (5 head + 1), jump by 995 → next is 1001
    expect(result).toContain('1001: last1');
    expect(result).toContain('1002: last2');
  });
});
