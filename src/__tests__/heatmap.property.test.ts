import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { getHeatmapIntensity, HeatmapIntensity } from '../lib/heatmap';

/**
 * Heatmap Intensity Property-Based Tests
 * 
 * These tests verify the correctness properties of the heatmap intensity mapping
 * as specified in the design document.
 */

/**
 * **Feature: cellines-obgyn-prep-v1, Property 5: Heatmap Color Intensity Mapping**
 * **Validates: Requirements 2.3**
 * 
 * For any `cards_reviewed` count:
 * - 0 cards SHALL map to intensity 0 (empty)
 * - 1-5 cards SHALL map to intensity 1 (light)
 * - 6-15 cards SHALL map to intensity 2 (medium)
 * - 16+ cards SHALL map to intensity 3 (dark)
 */
describe('Property 5: Heatmap Color Intensity Mapping', () => {
  test('0 cards maps to intensity 0 (empty)', () => {
    const result = getHeatmapIntensity(0);
    expect(result).toBe(0);
  });

  test('Negative counts map to intensity 0 (empty)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: -1 }), (count) => {
        const result = getHeatmapIntensity(count);
        expect(result).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  test('1-5 cards maps to intensity 1 (light)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (count) => {
        const result = getHeatmapIntensity(count);
        expect(result).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  test('6-15 cards maps to intensity 2 (medium)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 6, max: 15 }), (count) => {
        const result = getHeatmapIntensity(count);
        expect(result).toBe(2);
      }),
      { numRuns: 100 }
    );
  });

  test('16+ cards maps to intensity 3 (dark)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 16, max: 10000 }), (count) => {
        const result = getHeatmapIntensity(count);
        expect(result).toBe(3);
      }),
      { numRuns: 100 }
    );
  });

  test('Intensity is always a valid value (0, 1, 2, or 3)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 10000 }), (count) => {
        const result = getHeatmapIntensity(count);
        expect([0, 1, 2, 3]).toContain(result);
      }),
      { numRuns: 100 }
    );
  });

  test('Intensity is monotonically non-decreasing with count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        (count1, count2) => {
          const [smaller, larger] = count1 <= count2 ? [count1, count2] : [count2, count1];
          const intensity1 = getHeatmapIntensity(smaller);
          const intensity2 = getHeatmapIntensity(larger);
          expect(intensity2).toBeGreaterThanOrEqual(intensity1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Boundary values are correctly mapped', () => {
    // Test exact boundary values
    expect(getHeatmapIntensity(0)).toBe(0);
    expect(getHeatmapIntensity(1)).toBe(1);
    expect(getHeatmapIntensity(5)).toBe(1);
    expect(getHeatmapIntensity(6)).toBe(2);
    expect(getHeatmapIntensity(15)).toBe(2);
    expect(getHeatmapIntensity(16)).toBe(3);
  });
});
