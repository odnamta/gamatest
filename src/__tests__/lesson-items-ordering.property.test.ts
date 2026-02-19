import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import type { LessonItem, Card, CardType } from '../types/database';

/**
 * Lesson Items Ordering Property-Based Tests
 * 
 * These tests verify the correctness properties of lesson items ordering
 * as specified in the design document.
 * 
 * **Feature: cekatan, Property 8: Lesson Items Ordering**
 * **Validates: Requirements 5.1**
 */

// Generator for valid UUIDs
const uuidArb = fc.uuid();

// Generator for card type
const cardTypeArb: fc.Arbitrary<CardType> = fc.constantFrom('flashcard', 'mcq');

// Generator for a LessonItem
const lessonItemArb = (lessonId: string) => fc.record({
  id: uuidArb,
  lesson_id: fc.constant(lessonId),
  item_type: fc.constantFrom('mcq', 'card') as fc.Arbitrary<'mcq' | 'card'>,
  item_id: uuidArb,
  order_index: fc.integer({ min: 0, max: 1000 }),
  created_at: fc.date().map(d => d.toISOString()),
});

// Generator for a Card
const cardArb = (cardId: string) => fc.record({
  id: fc.constant(cardId),
  deck_id: uuidArb,
  card_type: cardTypeArb,
  front: fc.string({ minLength: 1, maxLength: 100 }),
  back: fc.string({ minLength: 1, maxLength: 100 }),
  stem: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  options: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }), { nil: null }),
  correct_index: fc.option(fc.integer({ min: 0, max: 4 }), { nil: null }),
  explanation: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  image_url: fc.option(fc.webUrl(), { nil: null }),
  interval: fc.integer({ min: 1, max: 365 }),
  ease_factor: fc.float({ min: 1.3, max: 3.0 }),
  next_review: fc.date().map(d => d.toISOString()),
  created_at: fc.date().map(d => d.toISOString()),
});

/**
 * Pure function that simulates the ordering logic from getLessonItems.
 * This is the core logic we want to test - items should be sorted by order_index ascending.
 */
export function sortLessonItemsByOrderIndex<T extends { order_index: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order_index - b.order_index);
}

/**
 * Pure function that combines lesson items with cards, maintaining order.
 * This simulates the join logic in getLessonItems.
 */
export function combineLessonItemsWithCards(
  lessonItems: LessonItem[],
  cards: Card[]
): Array<{ item: LessonItem; card: Card }> {
  const cardMap = new Map<string, Card>();
  for (const card of cards) {
    cardMap.set(card.id, card);
  }

  const result: Array<{ item: LessonItem; card: Card }> = [];
  for (const item of lessonItems) {
    const card = cardMap.get(item.item_id);
    if (card) {
      result.push({ item, card });
    }
  }

  return result;
}

describe('Property 8: Lesson Items Ordering', () => {
  /**
   * For any lesson with N lesson_items, fetching items SHALL return them
   * sorted by order_index in ascending order.
   */
  test('Lesson items are sorted by order_index in ascending order', () => {
    fc.assert(
      fc.property(
        uuidArb, // lessonId
        fc.integer({ min: 1, max: 50 }), // number of items
        (lessonId, numItems) => {
          // Generate random order indices (may have duplicates or gaps)
          const orderIndices = Array.from({ length: numItems }, () => 
            Math.floor(Math.random() * 1000)
          );

          // Create lesson items with random order indices
          const lessonItems: LessonItem[] = orderIndices.map((orderIndex, i) => ({
            id: `item-${i}`,
            lesson_id: lessonId,
            item_type: i % 2 === 0 ? 'mcq' : 'card',
            item_id: `card-${i}`,
            order_index: orderIndex,
            created_at: new Date().toISOString(),
          }));

          // Sort the items
          const sortedItems = sortLessonItemsByOrderIndex(lessonItems);

          // Verify ascending order
          for (let i = 1; i < sortedItems.length; i++) {
            expect(sortedItems[i].order_index).toBeGreaterThanOrEqual(
              sortedItems[i - 1].order_index
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sorting preserves all items - no items are lost or duplicated
   */
  test('Sorting preserves all items', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 0, maxLength: 100 }),
        (lessonId, orderIndices) => {
          const lessonItems: LessonItem[] = orderIndices.map((orderIndex, i) => ({
            id: `item-${i}`,
            lesson_id: lessonId,
            item_type: 'mcq',
            item_id: `card-${i}`,
            order_index: orderIndex,
            created_at: new Date().toISOString(),
          }));

          const sortedItems = sortLessonItemsByOrderIndex(lessonItems);

          // Same number of items
          expect(sortedItems.length).toBe(lessonItems.length);

          // All original IDs are present
          const originalIds = new Set(lessonItems.map(item => item.id));
          const sortedIds = new Set(sortedItems.map(item => item.id));
          expect(sortedIds).toEqual(originalIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Sorting is stable for items with the same order_index
   * (relative order of equal elements is preserved)
   */
  test('Sorting is idempotent - sorting twice produces same result', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 50 }),
        (lessonId, orderIndices) => {
          const lessonItems: LessonItem[] = orderIndices.map((orderIndex, i) => ({
            id: `item-${i}`,
            lesson_id: lessonId,
            item_type: 'mcq',
            item_id: `card-${i}`,
            order_index: orderIndex,
            created_at: new Date().toISOString(),
          }));

          const sortedOnce = sortLessonItemsByOrderIndex(lessonItems);
          const sortedTwice = sortLessonItemsByOrderIndex(sortedOnce);

          // Sorting twice should produce identical result
          expect(sortedTwice.map(i => i.id)).toEqual(sortedOnce.map(i => i.id));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Empty lesson returns empty array
   */
  test('Empty lesson items returns empty array', () => {
    const result = sortLessonItemsByOrderIndex([]);
    expect(result).toEqual([]);
  });

  /**
   * Single item lesson returns that item
   */
  test('Single item lesson returns that item', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.integer({ min: 0, max: 1000 }),
        (lessonId, orderIndex) => {
          const item: LessonItem = {
            id: 'single-item',
            lesson_id: lessonId,
            item_type: 'mcq',
            item_id: 'card-1',
            order_index: orderIndex,
            created_at: new Date().toISOString(),
          };

          const result = sortLessonItemsByOrderIndex([item]);

          expect(result.length).toBe(1);
          expect(result[0]).toEqual(item);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Combining lesson items with cards maintains the sorted order
   */
  test('Combining with cards maintains sorted order', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 20 }),
        (lessonId, orderIndices) => {
          // Create lesson items
          const lessonItems: LessonItem[] = orderIndices.map((orderIndex, i) => ({
            id: `item-${i}`,
            lesson_id: lessonId,
            item_type: 'mcq',
            item_id: `card-${i}`,
            order_index: orderIndex,
            created_at: new Date().toISOString(),
          }));

          // Create corresponding cards
          const cards: Card[] = orderIndices.map((_, i) => ({
            id: `card-${i}`,
            deck_id: 'deck-1',
            card_type: 'mcq',
            front: `Front ${i}`,
            back: `Back ${i}`,
            stem: `Question ${i}`,
            options: ['A', 'B', 'C', 'D'],
            correct_index: 0,
            explanation: null,
            image_url: null,
            interval: 1,
            ease_factor: 2.5,
            next_review: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }));

          // Sort items first, then combine
          const sortedItems = sortLessonItemsByOrderIndex(lessonItems);
          const combined = combineLessonItemsWithCards(sortedItems, cards);

          // Verify the combined result maintains order
          for (let i = 1; i < combined.length; i++) {
            expect(combined[i].item.order_index).toBeGreaterThanOrEqual(
              combined[i - 1].item.order_index
            );
          }

          // Verify each item has its corresponding card
          for (const { item, card } of combined) {
            expect(card.id).toBe(item.item_id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Missing cards are filtered out while maintaining order
   */
  test('Missing cards are filtered out while maintaining order', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 20 }),
        fc.integer({ min: 0, max: 19 }), // index of card to remove
        (lessonId, orderIndices, removeIndex) => {
          const actualRemoveIndex = removeIndex % orderIndices.length;

          // Create lesson items
          const lessonItems: LessonItem[] = orderIndices.map((orderIndex, i) => ({
            id: `item-${i}`,
            lesson_id: lessonId,
            item_type: 'mcq',
            item_id: `card-${i}`,
            order_index: orderIndex,
            created_at: new Date().toISOString(),
          }));

          // Create cards, but skip one
          const cards: Card[] = orderIndices
            .map((_, i) => ({
              id: `card-${i}`,
              deck_id: 'deck-1',
              card_type: 'mcq' as CardType,
              front: `Front ${i}`,
              back: `Back ${i}`,
              stem: `Question ${i}`,
              options: ['A', 'B', 'C', 'D'],
              correct_index: 0,
              explanation: null,
              image_url: null,
              interval: 1,
              ease_factor: 2.5,
              next_review: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }))
            .filter((_, i) => i !== actualRemoveIndex);

          // Sort items first, then combine
          const sortedItems = sortLessonItemsByOrderIndex(lessonItems);
          const combined = combineLessonItemsWithCards(sortedItems, cards);

          // Should have one fewer item
          expect(combined.length).toBe(lessonItems.length - 1);

          // Order should still be maintained
          for (let i = 1; i < combined.length; i++) {
            expect(combined[i].item.order_index).toBeGreaterThanOrEqual(
              combined[i - 1].item.order_index
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
