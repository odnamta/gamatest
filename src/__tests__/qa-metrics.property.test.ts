import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  formatQAMetrics,
  calculateCoverage,
  formatSessionSummary,
} from '@/lib/qa-metrics';

/**
 * QA Metrics Property-Based Tests
 *
 * Validates formatting and coverage calculation functions
 * used in the content staging workflow.
 */

// Generators
const countArb = fc.integer({ min: 0, max: 10000 });
const positiveCountArb = fc.integer({ min: 1, max: 10000 });
const missingNumbersArb = fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 0, maxLength: 100 });

describe('QA Metrics: calculateCoverage', () => {
  test('coverage is always between 0 and 100 when created <= detected', () => {
    fc.assert(
      fc.property(positiveCountArb, (detected) => {
        const created = fc.sample(fc.integer({ min: 0, max: detected }), 1)[0];
        const coverage = calculateCoverage(detected, created);
        expect(coverage).toBeGreaterThanOrEqual(0);
        expect(coverage).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });

  test('coverage is 100 when detected is 0', () => {
    fc.assert(
      fc.property(countArb, (created) => {
        const coverage = calculateCoverage(0, created);
        expect(coverage).toBe(100);
      }),
      { numRuns: 100 }
    );
  });

  test('coverage is 100 when created equals detected', () => {
    fc.assert(
      fc.property(positiveCountArb, (count) => {
        const coverage = calculateCoverage(count, count);
        expect(coverage).toBe(100);
      }),
      { numRuns: 100 }
    );
  });

  test('coverage is 0 when created is 0 and detected > 0', () => {
    fc.assert(
      fc.property(positiveCountArb, (detected) => {
        const coverage = calculateCoverage(detected, 0);
        expect(coverage).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('coverage is always an integer (Math.round applied)', () => {
    fc.assert(
      fc.property(positiveCountArb, countArb, (detected, created) => {
        const coverage = calculateCoverage(detected, created);
        expect(Number.isInteger(coverage)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('coverage increases monotonically with created count for fixed detected', () => {
    fc.assert(
      fc.property(
        positiveCountArb,
        countArb,
        countArb,
        (detected, createdA, createdB) => {
          const a = Math.min(createdA, detected);
          const b = Math.min(createdB, detected);
          const covA = calculateCoverage(detected, a);
          const covB = calculateCoverage(detected, b);
          if (a <= b) {
            expect(covA).toBeLessThanOrEqual(covB);
          } else {
            expect(covA).toBeGreaterThanOrEqual(covB);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('QA Metrics: formatQAMetrics', () => {
  test('output always contains detected count and created count', () => {
    fc.assert(
      fc.property(countArb, countArb, missingNumbersArb, (detected, created, missing) => {
        const result = formatQAMetrics(detected, created, missing);
        expect(result).toContain(`Detected ${detected} questions`);
        expect(result).toContain(`${created} cards created`);
      }),
      { numRuns: 100 }
    );
  });

  test('output contains "Missing:" section only when there are missing numbers', () => {
    fc.assert(
      fc.property(countArb, countArb, missingNumbersArb, (detected, created, missing) => {
        const result = formatQAMetrics(detected, created, missing);
        if (missing.length > 0) {
          expect(result).toContain('Missing:');
        } else {
          expect(result).not.toContain('Missing:');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('output includes all missing numbers when present', () => {
    fc.assert(
      fc.property(
        countArb,
        countArb,
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 }),
        (detected, created, missing) => {
          const result = formatQAMetrics(detected, created, missing);
          for (const num of missing) {
            expect(result).toContain(String(num));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('output uses dot separator between sections', () => {
    fc.assert(
      fc.property(countArb, countArb, (detected, created) => {
        const result = formatQAMetrics(detected, created, []);
        expect(result).toContain(' \u00b7 ');
      }),
      { numRuns: 100 }
    );
  });
});

describe('QA Metrics: formatSessionSummary', () => {
  test('output always starts with draft card count', () => {
    fc.assert(
      fc.property(countArb, countArb, countArb, (draft, detected, missing) => {
        const result = formatSessionSummary(draft, detected, missing);
        expect(result).toMatch(new RegExp(`^${draft} draft cards`));
      }),
      { numRuns: 100 }
    );
  });

  test('includes detected count only when detected > 0', () => {
    fc.assert(
      fc.property(countArb, countArb, countArb, (draft, detected, missing) => {
        const result = formatSessionSummary(draft, detected, missing);
        if (detected > 0) {
          expect(result).toContain(`Detected ${detected}`);
        } else {
          expect(result).not.toContain('Detected');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('includes missing count only when missing > 0', () => {
    fc.assert(
      fc.property(countArb, countArb, countArb, (draft, detected, missing) => {
        const result = formatSessionSummary(draft, detected, missing);
        if (missing > 0) {
          expect(result).toContain(`Missing ${missing}`);
        } else {
          expect(result).not.toContain('Missing');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('sections are separated by dot separator', () => {
    fc.assert(
      fc.property(
        countArb,
        positiveCountArb,
        positiveCountArb,
        (draft, detected, missing) => {
          const result = formatSessionSummary(draft, detected, missing);
          // When detected and missing are both > 0, there should be separators
          const parts = result.split(' \u00b7 ');
          expect(parts.length).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('output with zeros is just the draft count', () => {
    fc.assert(
      fc.property(countArb, (draft) => {
        const result = formatSessionSummary(draft, 0, 0);
        expect(result).toBe(`${draft} draft cards`);
      }),
      { numRuns: 100 }
    );
  });
});
