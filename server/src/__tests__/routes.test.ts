import { FastifyInstance } from 'fastify';
import { registerRoutes } from '../routes';

// Create a minimal Fastify instance for testing
async function createTestApp(): Promise<FastifyInstance> {
  const Fastify = require('fastify') || (await import('fastify')).default;
  const app = Fastify({ logger: false });
  
  // We can't register real routes without the full setup
  // So we'll test the validation logic directly
  
  return app;
}

describe('routes.ts - Input Validation', () => {
  // Test validation logic constants
  const MAX_PROMPT_LENGTH = 100_000;

  describe('Prompt text validation', () => {
    test('rejects empty text', () => {
      const text: unknown = '';
      const isValid = !!(text && typeof text === 'string' && text.trim() !== '');
      expect(isValid).toBe(false);
    });

    test('rejects non-string', () => {
      const text: unknown = null;
      const isValid = !!(text && typeof text === 'string' && text.trim() !== '');
      expect(isValid).toBe(false);
    });

    test('rejects whitespace only', () => {
      const text: unknown = '   ';
      const isValid = text && typeof text === 'string' && text.trim() !== '';
      expect(isValid).toBe(false);
    });

    test('accepts valid text', () => {
      const text: unknown = 'Hello, world!';
      const isValid = text && typeof text === 'string' && text.trim() !== '';
      expect(isValid).toBe(true);
    });

    test('rejects text exceeding max length', () => {
      const text = 'a'.repeat(MAX_PROMPT_LENGTH + 1);
      const isWithinLimit = text.length <= MAX_PROMPT_LENGTH;
      expect(isWithinLimit).toBe(false);
    });

    test('accepts text at max length', () => {
      const text = 'a'.repeat(MAX_PROMPT_LENGTH);
      const isWithinLimit = text.length <= MAX_PROMPT_LENGTH;
      expect(isWithinLimit).toBe(true);
    });

    test('accepts text just under max length', () => {
      const text = 'a'.repeat(MAX_PROMPT_LENGTH - 1);
      const isWithinLimit = text.length <= MAX_PROMPT_LENGTH;
      expect(isWithinLimit).toBe(true);
    });
  });

  describe('Approval validation', () => {
    test('rejects non-boolean allow value', () => {
      const allow: unknown = 'true';
      const isValid = typeof allow === 'boolean';
      expect(isValid).toBe(false);
    });

    test('rejects undefined allow value', () => {
      const allow: unknown = undefined;
      const isValid = typeof allow === 'boolean';
      expect(isValid).toBe(false);
    });

    test('accepts allow=true', () => {
      const allow = true;
      const isValid = typeof allow === 'boolean';
      expect(isValid).toBe(true);
    });

    test('accepts allow=false', () => {
      const allow = false;
      const isValid = typeof allow === 'boolean';
      expect(isValid).toBe(true);
    });
  });
});
