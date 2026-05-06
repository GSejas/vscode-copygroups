import { createPreprompt, validatePreprompt } from '../../../../src/domain/entities/Preprompt';

describe('Preprompt Entity', () => {
  describe('createPreprompt', () => {
    it('creates a preprompt with minimal data (happy path)', () => {
      const preprompt = createPreprompt('Review Code', 'Review this: {{context}}');

      expect(preprompt.name).toBe('Review Code');
      expect(preprompt.template).toBe('Review this: {{context}}');
      expect(preprompt.mode).toBe('custom');
      expect(preprompt.id).toBeTruthy();
      expect(preprompt.id).toMatch(/^preprompt-\d+-[a-z0-9]+$/);
      expect(preprompt.createdAt).toBeInstanceOf(Date);
      expect(preprompt.updatedAt).toBeInstanceOf(Date);
      expect(preprompt.isSystem).toBeUndefined();
      expect(preprompt.variables).toBeUndefined();
    });

    it('creates a preprompt with full data (happy path)', () => {
      const variables = { level: 'high', skipTests: 'true' };
      const preprompt = createPreprompt(
        'Security Audit',
        'Audit code for {{level}} security issues',
        'review',
        variables
      );

      expect(preprompt.name).toBe('Security Audit');
      expect(preprompt.template).toBe('Audit code for {{level}} security issues');
      expect(preprompt.mode).toBe('review');
      expect(preprompt.variables).toEqual(variables);
      expect(preprompt.id).toBeTruthy();
      expect(preprompt.createdAt).toBeInstanceOf(Date);
      expect(preprompt.updatedAt).toBeInstanceOf(Date);
    });

    it('trims whitespace from name', () => {
      const preprompt = createPreprompt('  Trimmed Name  ', 'Template');

      expect(preprompt.name).toBe('Trimmed Name');
    });

    it('accepts all valid modes', () => {
      const modes = ['analysis', 'summary', 'review', 'custom'] as const;

      modes.forEach((mode) => {
        const preprompt = createPreprompt('Test', 'Template', mode);
        expect(preprompt.mode).toBe(mode);
      });
    });

    it('generates unique IDs for preprompts', () => {
      const p1 = createPreprompt('First', 'Template 1');
      const p2 = createPreprompt('Second', 'Template 2');

      expect(p1.id).not.toBe(p2.id);
    });

    it('defaults to current date for createdAt and updatedAt', () => {
      const beforeCreate = new Date();
      const preprompt = createPreprompt('Test', 'Template');
      const afterCreate = new Date();

      expect(preprompt.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(preprompt.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(preprompt.updatedAt).toEqual(preprompt.createdAt);
    });
  });

  describe('validatePreprompt', () => {
    it('validates a valid preprompt (happy path)', () => {
      const preprompt = createPreprompt('Valid', 'Template');

      expect(validatePreprompt(preprompt)).toBe(true);
    });

    it('rejects null', () => {
      expect(validatePreprompt(null)).toBe(false);
    });

    it('rejects non-object', () => {
      expect(validatePreprompt('string')).toBe(false);
      expect(validatePreprompt(42)).toBe(false);
      expect(validatePreprompt(undefined)).toBe(false);
      expect(validatePreprompt([])).toBe(false);
    });

    it('rejects missing required id', () => {
      const preprompt = createPreprompt('Test', 'Template');
      const invalid = { ...preprompt, id: undefined };

      expect(validatePreprompt(invalid)).toBe(false);
    });

    it('rejects missing required name', () => {
      const preprompt = createPreprompt('Test', 'Template');
      const invalid = { ...preprompt, name: undefined };

      expect(validatePreprompt(invalid)).toBe(false);
    });

    it('rejects missing required template', () => {
      const preprompt = createPreprompt('Test', 'Template');
      const invalid = { ...preprompt, template: undefined };

      expect(validatePreprompt(invalid)).toBe(false);
    });

    it('rejects missing or invalid mode', () => {
      const preprompt = createPreprompt('Test', 'Template');

      expect(validatePreprompt({ ...preprompt, mode: undefined })).toBe(false);
      expect(validatePreprompt({ ...preprompt, mode: 'invalid' })).toBe(false);
    });

    it('accepts valid modes in validation', () => {
      const modes = ['analysis', 'summary', 'review', 'custom'];

      modes.forEach((mode) => {
        const preprompt = createPreprompt('Test', 'Template', mode as any);
        expect(validatePreprompt(preprompt)).toBe(true);
      });
    });

    it('allows undefined optional fields', () => {
      const preprompt = createPreprompt('Test', 'Template');
      const withoutOptional = {
        id: preprompt.id,
        name: preprompt.name,
        template: preprompt.template,
        mode: preprompt.mode,
      };

      expect(validatePreprompt(withoutOptional)).toBe(true);
    });

    it('rejects non-string values for required fields', () => {
      const preprompt = createPreprompt('Test', 'Template');

      expect(validatePreprompt({ ...preprompt, id: 123 })).toBe(false);
      expect(validatePreprompt({ ...preprompt, name: 123 })).toBe(false);
      expect(validatePreprompt({ ...preprompt, template: 123 })).toBe(false);
    });
  });
});
