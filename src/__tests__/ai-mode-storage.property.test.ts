import { describe, test, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import type { AIMode } from '@/lib/ai-mode-storage';

/**
 * AI Mode Storage Property-Based Tests
 *
 * Validates localStorage-backed state management for AI draft mode.
 *
 * Node.js 25 introduced a built-in localStorage global that lacks .clear()
 * and conflicts with jsdom's version. We stub globalThis.localStorage with
 * a proper Map-backed implementation to ensure consistent behavior.
 */

const STORAGE_KEY = 'ai-draft-mode';
const validModeArb = fc.constantFrom<AIMode>('extract', 'generate');

// Create a proper localStorage mock that supports clear()
function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockStorage();
  vi.stubGlobal('localStorage', mockStorage);
});

// We must import dynamically after stubbing, but since the module reads
// localStorage at call time (not import time), we can import statically
// and the functions will use our stubbed global.
// Re-import to get fresh module references that use our stubbed localStorage.
let getAIMode: typeof import('@/lib/ai-mode-storage').getAIMode;
let setAIMode: typeof import('@/lib/ai-mode-storage').setAIMode;

beforeEach(async () => {
  const mod = await import('@/lib/ai-mode-storage');
  getAIMode = mod.getAIMode;
  setAIMode = mod.setAIMode;
});

describe('AI Mode Storage: getAIMode', () => {
  test('returns "extract" as default when nothing is stored', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        mockStorage.clear();
        expect(getAIMode()).toBe('extract');
      }),
      { numRuns: 10 }
    );
  });

  test('returns the stored mode when valid', () => {
    fc.assert(
      fc.property(validModeArb, (mode) => {
        mockStorage.setItem(STORAGE_KEY, mode);
        expect(getAIMode()).toBe(mode);
      }),
      { numRuns: 100 }
    );
  });

  test('returns "extract" for any invalid stored value', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== 'extract' && s !== 'generate'),
        (invalidValue) => {
          mockStorage.setItem(STORAGE_KEY, invalidValue);
          expect(getAIMode()).toBe('extract');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('AI Mode Storage: setAIMode', () => {
  test('round-trip: setAIMode then getAIMode returns the same value', () => {
    fc.assert(
      fc.property(validModeArb, (mode) => {
        setAIMode(mode);
        expect(getAIMode()).toBe(mode);
      }),
      { numRuns: 100 }
    );
  });

  test('setAIMode overwrites previous value', () => {
    fc.assert(
      fc.property(validModeArb, validModeArb, (first, second) => {
        setAIMode(first);
        setAIMode(second);
        expect(getAIMode()).toBe(second);
      }),
      { numRuns: 100 }
    );
  });

  test('setAIMode writes to localStorage with correct key', () => {
    fc.assert(
      fc.property(validModeArb, (mode) => {
        setAIMode(mode);
        expect(mockStorage.getItem(STORAGE_KEY)).toBe(mode);
      }),
      { numRuns: 100 }
    );
  });
});

describe('AI Mode Storage: determinism', () => {
  test('getAIMode is idempotent — calling it twice returns the same result', () => {
    fc.assert(
      fc.property(validModeArb, (mode) => {
        setAIMode(mode);
        const first = getAIMode();
        const second = getAIMode();
        expect(first).toBe(second);
      }),
      { numRuns: 100 }
    );
  });

  test('getAIMode always returns a valid AIMode value', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }),
        (maybeValue) => {
          mockStorage.clear();
          if (maybeValue !== undefined) {
            mockStorage.setItem(STORAGE_KEY, maybeValue);
          }
          const result = getAIMode();
          expect(['extract', 'generate']).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });
});
