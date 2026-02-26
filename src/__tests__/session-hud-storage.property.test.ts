import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  getSessionCardCount,
  addToSessionCardCount,
  resetSessionCardCount,
} from '@/lib/session-hud-storage';

/**
 * Session HUD Storage Property-Based Tests
 *
 * Validates sessionStorage-backed card count tracking per PDF source.
 * Uses jsdom environment (provided by vitest config).
 *
 * Note: We use window.sessionStorage explicitly because Node.js 25 exposes
 * a limited built-in sessionStorage global that conflicts with jsdom's version.
 */

const STORAGE_KEY_PREFIX = 'session-cards-';

// Generator for source IDs (alphanumeric + dash/underscore, non-empty)
const sourceIdArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/);
const positiveCountArb = fc.integer({ min: 1, max: 1000 });
const nonNegativeCountArb = fc.integer({ min: 0, max: 1000 });

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('Session HUD Storage: getSessionCardCount', () => {
  test('returns 0 when nothing is stored for a source', () => {
    fc.assert(
      fc.property(sourceIdArb, (sourceId) => {
        window.sessionStorage.clear();
        expect(getSessionCardCount(sourceId)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('returns stored value when valid integer is stored', () => {
    fc.assert(
      fc.property(sourceIdArb, nonNegativeCountArb, (sourceId, count) => {
        window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${sourceId}`, count.toString());
        expect(getSessionCardCount(sourceId)).toBe(count);
      }),
      { numRuns: 100 }
    );
  });

  test('returns 0 when stored value is NaN', () => {
    fc.assert(
      fc.property(
        sourceIdArb,
        fc.string().filter((s) => isNaN(parseInt(s, 10))),
        (sourceId, invalidValue) => {
          window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${sourceId}`, invalidValue);
          expect(getSessionCardCount(sourceId)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Session HUD Storage: addToSessionCardCount', () => {
  test('first add to empty source returns the added count', () => {
    fc.assert(
      fc.property(sourceIdArb, positiveCountArb, (sourceId, count) => {
        window.sessionStorage.clear();
        const result = addToSessionCardCount(sourceId, count);
        expect(result).toBe(count);
      }),
      { numRuns: 100 }
    );
  });

  test('successive adds are cumulative', () => {
    fc.assert(
      fc.property(sourceIdArb, positiveCountArb, positiveCountArb, (sourceId, countA, countB) => {
        window.sessionStorage.clear();
        addToSessionCardCount(sourceId, countA);
        const result = addToSessionCardCount(sourceId, countB);
        expect(result).toBe(countA + countB);
      }),
      { numRuns: 100 }
    );
  });

  test('addToSessionCardCount persists to sessionStorage', () => {
    fc.assert(
      fc.property(sourceIdArb, positiveCountArb, (sourceId, count) => {
        window.sessionStorage.clear();
        addToSessionCardCount(sourceId, count);
        expect(getSessionCardCount(sourceId)).toBe(count);
      }),
      { numRuns: 100 }
    );
  });

  test('different source IDs track independently', () => {
    fc.assert(
      fc.property(sourceIdArb, sourceIdArb, positiveCountArb, positiveCountArb, (idA, idB, countA, countB) => {
        fc.pre(idA !== idB);
        window.sessionStorage.clear();
        addToSessionCardCount(idA, countA);
        addToSessionCardCount(idB, countB);
        expect(getSessionCardCount(idA)).toBe(countA);
        expect(getSessionCardCount(idB)).toBe(countB);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Session HUD Storage: resetSessionCardCount', () => {
  test('reset sets count back to 0', () => {
    fc.assert(
      fc.property(sourceIdArb, positiveCountArb, (sourceId, count) => {
        window.sessionStorage.clear();
        addToSessionCardCount(sourceId, count);
        resetSessionCardCount(sourceId);
        expect(getSessionCardCount(sourceId)).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('reset on non-existent source does not throw', () => {
    fc.assert(
      fc.property(sourceIdArb, (sourceId) => {
        window.sessionStorage.clear();
        expect(() => resetSessionCardCount(sourceId)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  test('reset only affects the specified source', () => {
    fc.assert(
      fc.property(sourceIdArb, sourceIdArb, positiveCountArb, positiveCountArb, (idA, idB, countA, countB) => {
        fc.pre(idA !== idB);
        window.sessionStorage.clear();
        addToSessionCardCount(idA, countA);
        addToSessionCardCount(idB, countB);
        resetSessionCardCount(idA);
        expect(getSessionCardCount(idA)).toBe(0);
        expect(getSessionCardCount(idB)).toBe(countB);
      }),
      { numRuns: 100 }
    );
  });
});
