/**
 * Preprompt Entity
 * Stores LLM instruction templates with variable substitution
 */

export type PrepromptMode = 'analysis' | 'summary' | 'review' | 'custom';

export interface Preprompt {
  id: string;
  name: string;
  template: string; // Template with {{variable}} placeholders
  mode: PrepromptMode;
  isSystem?: boolean; // true for system preprompts, false/undefined for custom
  variables?: Record<string, string>; // Custom variables
  createdAt: Date;
  updatedAt: Date;
}

export interface PrepromptVariables {
  groupName: string;
  fileCount: number;
  timestamp: string;
  mode: string;
  context: string;
}

export function validatePreprompt(prompt: any): prompt is Preprompt {
  if (!prompt || typeof prompt !== 'object') return false;
  if (!prompt.id || typeof prompt.id !== 'string') return false;
  if (!prompt.name || typeof prompt.name !== 'string') return false;
  if (!prompt.template || typeof prompt.template !== 'string') return false;
  if (!prompt.mode || !['analysis', 'summary', 'review', 'custom'].includes(prompt.mode)) return false;
  return true;
}

export function createPreprompt(
  name: string,
  template: string,
  mode: PrepromptMode = 'custom',
  variables?: Record<string, string>
): Preprompt {
  const now = new Date();
  return {
    id: `preprompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    template,
    mode,
    variables,
    createdAt: now,
    updatedAt: now,
  };
}

export const SYSTEM_PREPROMPTS: Record<string, Preprompt> = {
  SECURITY_REVIEW: {
    ...createPreprompt(
      'Security Review',
      `Review the following code for security vulnerabilities:

{{context}}

Focus on:
- Authentication & authorization
- Input validation & sanitization
- Sensitive data exposure
- SQL injection & code injection
- CSRF & XSS vulnerabilities`,
      'review'
    ),
    isSystem: true,
  },
  ARCHITECTURE_ANALYSIS: {
    ...createPreprompt(
      'Architecture Analysis',
      `Analyze the architecture and design patterns in these files:

{{context}}

Provide insights on:
- Design patterns used
- Separation of concerns
- Code organization
- Potential improvements`,
      'analysis'
    ),
    isSystem: true,
  },
  PERFORMANCE_OPTIMIZATION: {
    ...createPreprompt(
      'Performance Optimization',
      `Review these files for performance optimization opportunities:

{{context}}

Focus on:
- Algorithm efficiency
- Database queries
- Memory usage
- Caching opportunities`,
      'review'
    ),
    isSystem: true,
  },
  DOCUMENTATION_GENERATION: {
    ...createPreprompt(
      'Documentation Generation',
      `Generate documentation for these files:

{{context}}

Include:
- Function/class descriptions
- Parameter documentation
- Return value documentation
- Usage examples`,
      'summary'
    ),
    isSystem: true,
  },
};
