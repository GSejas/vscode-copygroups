/**
 * PythonContextExtractor
 * Specialized extraction for Python files with Python-aware parsing
 */

export class PythonContextExtractor {
  /**
   * Extract docstrings and comments from Python code
   */
  extractDocstrings(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inMultilineString = false;
    let stringDelimiter = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for multiline string delimiters (""" or ''')
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        const delimiter = trimmed.startsWith('"""') ? '"""' : "'''";
        if (inMultilineString && stringDelimiter === delimiter) {
          inMultilineString = false;
          result.push(line);
          continue;
        } else if (!inMultilineString) {
          inMultilineString = true;
          stringDelimiter = delimiter;
          result.push(line);
          continue;
        }
      }

      if (inMultilineString) {
        result.push(line);
        continue;
      }

      // Include comments and single docstrings
      if (trimmed.startsWith('#')) {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Extract skeleton (class/function definitions) from Python code
   * Preserves structure while removing implementation
   */
  extractSkeleton(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Detect class definitions
      if (trimmed.startsWith('class ')) {
        result.push(line);
        // Include class docstring if present
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
            result.push(lines[i + 1]);
            if (!nextLine.endsWith(nextLine.startsWith('"""') ? '"""' : "'''")) {
              i++;
              while (i + 1 < lines.length && !lines[i + 1].trim().endsWith(nextLine.startsWith('"""') ? '"""' : "'''")) {
                i++;
                result.push(lines[i]);
              }
              if (i + 1 < lines.length) {
                result.push(lines[i + 1]);
                i++;
              }
            }
          }
        }
        continue;
      }

      // Detect function/method definitions
      if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
        result.push(line);
        // Include docstring if present
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
            result.push(lines[i + 1]);
            if (!nextLine.endsWith(nextLine.startsWith('"""') ? '"""' : "'''")) {
              i++;
              while (i + 1 < lines.length && !lines[i + 1].trim().endsWith(nextLine.startsWith('"""') ? '"""' : "'''")) {
                i++;
                result.push(lines[i]);
              }
              if (i + 1 < lines.length) {
                result.push(lines[i + 1]);
                i++;
              }
            }
          }
        }
        continue;
      }

      // Include decorator and import statements
      if (trimmed.startsWith('@') || trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        result.push(line);
        continue;
      }

      // Include top-level assignments (constants, module-level variables)
      const currentIndent = line.length - line.trimStart().length;
      if (currentIndent === 0 && (trimmed.includes('=') || trimmed.startsWith('_'))) {
        result.push(line);
        continue;
      }
    }

    return result.join('\n');
  }

  /**
   * Extract function signatures with their decorators and docstrings
   */
  extractFunctionSignatures(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    const decorators: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Collect decorators
      if (trimmed.startsWith('@')) {
        decorators.push(line);
        continue;
      }

      // Process function definitions
      if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
        result.push(...decorators);
        decorators.length = 0;

        // Find complete function signature (handle multiline)
        let signature = line;
        if (!trimmed.endsWith(':')) {
          i++;
          while (i < lines.length && !lines[i].trim().endsWith(':')) {
            signature += '\n' + lines[i];
            i++;
          }
          if (i < lines.length) {
            signature += '\n' + lines[i];
          }
        }
        result.push(signature);

        // Include docstring
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
            const delimiter = nextLine.startsWith('"""') ? '"""' : "'''";
            result.push(lines[i + 1]);
            i++;

            if (!nextLine.endsWith(delimiter)) {
              while (i + 1 < lines.length && !lines[i + 1].trim().includes(delimiter)) {
                result.push(lines[i + 1]);
                i++;
              }
              if (i + 1 < lines.length) {
                result.push(lines[i + 1]);
                i++;
              }
            }
          }
        }

        continue;
      }

      // Reset decorators if we encounter non-function
      if (decorators.length > 0 && !trimmed.startsWith('@') && !trimmed.startsWith('def ') && !trimmed.startsWith('async def ')) {
        decorators.length = 0;
      }
    }

    return result.join('\n');
  }

  /**
   * Extract imports and class/function definitions (minimal skeleton)
   */
  extractImportsAndDefinitions(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('from ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('def ') ||
        trimmed.startsWith('async def ') ||
        trimmed.startsWith('@')
      ) {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Detect Python entry points and main execution patterns
   */
  extractMainExports(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inMain = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Add imports
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        result.push(line);
        continue;
      }

      // Detect if __name__ == '__main__'
      if (trimmed.includes("if __name__") && trimmed.includes('__main__')) {
        inMain = true;
        result.push(line);
        continue;
      }

      // Include main block content
      if (inMain) {
        result.push(line);
        // Continue until dedent
        if (trimmed && !line.startsWith(' ') && !line.startsWith('\t')) {
          inMain = false;
        }
      }
    }

    return result.join('\n');
  }

  /**
   * Extract public API (functions/classes not starting with _)
   */
  extractPublicAPI(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    const decorators: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Add imports
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        result.push(line);
        continue;
      }

      // Collect decorators
      if (trimmed.startsWith('@')) {
        decorators.push(line);
        continue;
      }

      // Process class/function definitions (only public ones)
      if ((trimmed.startsWith('class ') || trimmed.startsWith('def ') || trimmed.startsWith('async def ')) && !trimmed.includes('_')) {
        result.push(...decorators);
        decorators.length = 0;

        // Find complete signature
        let signature = line;
        if (!trimmed.endsWith(':')) {
          i++;
          while (i < lines.length && !lines[i].trim().endsWith(':')) {
            signature += '\n' + lines[i];
            i++;
          }
          if (i < lines.length) {
            signature += '\n' + lines[i];
          }
        }
        result.push(signature);

        // Include docstring
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
            result.push(lines[i + 1]);
            i++;
          }
        }

        continue;
      }

      decorators.length = 0;
    }

    return result.join('\n');
  }
}
