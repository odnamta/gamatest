import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  filterSourcesForDeck,
  isSourceLinkedToDeck,
  createDeckSourceLink,
  validateDeckSourceLink,
  getLinkedSourcesForDeck,
} from '../lib/source-deck-linking';
import type { Source, DeckSource, Deck } from '@/types/database';

/**
 * **Feature: cekatan, Property 15: Source-Deck Linking**
 * **Validates: Requirements 8.3, 9.3**
 *
 * For any source linked to a deck:
 * - A deck_sources record SHALL exist with the correct deck_id and source_id
 * - The source SHALL be retrievable when querying sources for that deck
 */
describe('Property 15: Source-Deck Linking', () => {
  // Generator for valid UUIDs
  const uuidArb = fc.uuid();

  // Generator for ISO date strings
  const minTimestamp = new Date('2020-01-01').getTime();
  const maxTimestamp = new Date('2030-12-31').getTime();
  const isoDateArb = fc
    .integer({ min: minTimestamp, max: maxTimestamp })
    .map((ts) => new Date(ts).toISOString());

  // Generator for titles
  const titleArb = fc.string({ minLength: 1, maxLength: 100 });

  // Generator for file URLs
  const fileUrlArb = fc.webUrl();

  // Generator for Source
  const sourceArb = fc.record({
    id: uuidArb,
    user_id: uuidArb,
    title: titleArb,
    type: fc.constantFrom('pdf_book', 'pdf_notes', 'document'),
    file_url: fileUrlArb,
    metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
    created_at: isoDateArb,
  }) as fc.Arbitrary<Source>;

  // Generator for Deck
  const deckArb = fc.record({
    id: uuidArb,
    user_id: uuidArb,
    title: titleArb,
    created_at: isoDateArb,
  }) as fc.Arbitrary<Deck>;

  // Generator for DeckSource
  const deckSourceArb = fc.record({
    id: uuidArb,
    deck_id: uuidArb,
    source_id: uuidArb,
    created_at: isoDateArb,
  }) as fc.Arbitrary<DeckSource>;

  describe('Deck-Source Link Record Validation (Requirements 8.3)', () => {
    test('valid link has matching deck_id and source_id', () => {
      fc.assert(
        fc.property(sourceArb, deckArb, deckSourceArb, (source, deck, baseDeckSource) => {
          // Create a properly linked deck_source
          const deckSource: DeckSource = {
            ...baseDeckSource,
            deck_id: deck.id,
            source_id: source.id,
          };

          const result = validateDeckSourceLink(deckSource, source, deck);

          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    test('invalid link when source_id does not match', () => {
      fc.assert(
        fc.property(sourceArb, deckArb, deckSourceArb, uuidArb, (source, deck, baseDeckSource, wrongSourceId) => {
          fc.pre(wrongSourceId !== source.id);

          const deckSource: DeckSource = {
            ...baseDeckSource,
            deck_id: deck.id,
            source_id: wrongSourceId,
          };

          const result = validateDeckSourceLink(deckSource, source, deck);

          expect(result.valid).toBe(false);
          expect(result.error).toContain('source_id');
        }),
        { numRuns: 100 }
      );
    });

    test('invalid link when deck_id does not match', () => {
      fc.assert(
        fc.property(sourceArb, deckArb, deckSourceArb, uuidArb, (source, deck, baseDeckSource, wrongDeckId) => {
          fc.pre(wrongDeckId !== deck.id);

          const deckSource: DeckSource = {
            ...baseDeckSource,
            deck_id: wrongDeckId,
            source_id: source.id,
          };

          const result = validateDeckSourceLink(deckSource, source, deck);

          expect(result.valid).toBe(false);
          expect(result.error).toContain('deck_id');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Source Retrieval for Deck (Requirements 8.3, 9.3)', () => {
    test('linked source is retrievable when querying sources for deck', () => {
      fc.assert(
        fc.property(
          fc.array(sourceArb, { minLength: 1, maxLength: 10 }),
          deckArb,
          (sources, deck) => {
            // Pick a random source to link
            const sourceToLink = sources[0];

            // Create the link
            const deckSource: DeckSource = {
              id: crypto.randomUUID(),
              deck_id: deck.id,
              source_id: sourceToLink.id,
              created_at: new Date().toISOString(),
            };

            // Query sources for the deck
            const linkedSources = filterSourcesForDeck(deck.id, sources, [deckSource]);

            // The linked source should be in the results
            expect(linkedSources).toContainEqual(sourceToLink);
            expect(linkedSources.length).toBeGreaterThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('unlinked sources are not returned when querying for deck', () => {
      fc.assert(
        fc.property(
          fc.array(sourceArb, { minLength: 2, maxLength: 10 }),
          deckArb,
          (sources, deck) => {
            // Link only the first source
            const linkedSource = sources[0];
            const unlinkedSources = sources.slice(1);

            const deckSource: DeckSource = {
              id: crypto.randomUUID(),
              deck_id: deck.id,
              source_id: linkedSource.id,
              created_at: new Date().toISOString(),
            };

            // Query sources for the deck
            const result = filterSourcesForDeck(deck.id, sources, [deckSource]);

            // Only the linked source should be returned
            expect(result).toContainEqual(linkedSource);
            unlinkedSources.forEach(unlinked => {
              expect(result).not.toContainEqual(unlinked);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple sources can be linked to the same deck', () => {
      fc.assert(
        fc.property(
          fc.array(sourceArb, { minLength: 2, maxLength: 5 }),
          deckArb,
          (sources, deck) => {
            // Link all sources to the deck
            const deckSources: DeckSource[] = sources.map(source => ({
              id: crypto.randomUUID(),
              deck_id: deck.id,
              source_id: source.id,
              created_at: new Date().toISOString(),
            }));

            // Query sources for the deck
            const result = filterSourcesForDeck(deck.id, sources, deckSources);

            // All sources should be returned
            expect(result.length).toBe(sources.length);
            sources.forEach(source => {
              expect(result).toContainEqual(source);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sources linked to other decks are not returned', () => {
      fc.assert(
        fc.property(
          fc.array(sourceArb, { minLength: 1, maxLength: 5 }),
          deckArb,
          deckArb,
          (sources, targetDeck, otherDeck) => {
            fc.pre(targetDeck.id !== otherDeck.id);

            // Link sources to the other deck, not the target deck
            const deckSources: DeckSource[] = sources.map(source => ({
              id: crypto.randomUUID(),
              deck_id: otherDeck.id,
              source_id: source.id,
              created_at: new Date().toISOString(),
            }));

            // Query sources for the target deck
            const result = filterSourcesForDeck(targetDeck.id, sources, deckSources);

            // No sources should be returned for the target deck
            expect(result.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Link Creation (Requirements 9.3)', () => {
    test('creating a link returns a valid deck_source record', () => {
      fc.assert(
        fc.property(sourceArb, deckArb, (source, deck) => {
          const newLink = createDeckSourceLink(source.id, deck.id, []);

          expect(newLink).not.toBeNull();
          if (newLink) {
            expect(newLink.source_id).toBe(source.id);
            expect(newLink.deck_id).toBe(deck.id);
            expect(newLink.id).toBeDefined();
            expect(newLink.created_at).toBeDefined();
          }
        }),
        { numRuns: 100 }
      );
    });

    test('creating a duplicate link returns null', () => {
      fc.assert(
        fc.property(sourceArb, deckArb, (source, deck) => {
          // Create an existing link
          const existingLink: DeckSource = {
            id: crypto.randomUUID(),
            deck_id: deck.id,
            source_id: source.id,
            created_at: new Date().toISOString(),
          };

          // Try to create a duplicate
          const duplicateLink = createDeckSourceLink(source.id, deck.id, [existingLink]);

          expect(duplicateLink).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    test('isSourceLinkedToDeck returns true for linked sources', () => {
      fc.assert(
        fc.property(sourceArb, deckArb, (source, deck) => {
          const deckSource: DeckSource = {
            id: crypto.randomUUID(),
            deck_id: deck.id,
            source_id: source.id,
            created_at: new Date().toISOString(),
          };

          const isLinked = isSourceLinkedToDeck(source.id, deck.id, [deckSource]);

          expect(isLinked).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    test('isSourceLinkedToDeck returns false for unlinked sources', () => {
      fc.assert(
        fc.property(sourceArb, deckArb, deckArb, (source, deck, otherDeck) => {
          fc.pre(deck.id !== otherDeck.id);

          // Link to a different deck
          const deckSource: DeckSource = {
            id: crypto.randomUUID(),
            deck_id: otherDeck.id,
            source_id: source.id,
            created_at: new Date().toISOString(),
          };

          const isLinked = isSourceLinkedToDeck(source.id, deck.id, [deckSource]);

          expect(isLinked).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Linked Sources with Records (Requirements 8.3)', () => {
    test('getLinkedSourcesForDeck returns sources with their link records', () => {
      fc.assert(
        fc.property(
          fc.array(sourceArb, { minLength: 1, maxLength: 5 }),
          deckArb,
          (sources, deck) => {
            // Link all sources
            const deckSources: DeckSource[] = sources.map(source => ({
              id: crypto.randomUUID(),
              deck_id: deck.id,
              source_id: source.id,
              created_at: new Date().toISOString(),
            }));

            const linkedSources = getLinkedSourcesForDeck(deck.id, sources, deckSources);

            // Should return all linked sources with their records
            expect(linkedSources.length).toBe(sources.length);
            linkedSources.forEach(ls => {
              expect(ls.source).toBeDefined();
              expect(ls.deckSource).toBeDefined();
              expect(ls.deckSource.deck_id).toBe(deck.id);
              expect(ls.deckSource.source_id).toBe(ls.source.id);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
