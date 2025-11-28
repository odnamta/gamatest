import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  getNextField,
  getSelectedText,
  FIELD_SEQUENCE,
  TargetField,
} from '../components/cards/TextSelectionToolbar';

/**
 * **Feature: v3.1-bugfix-ux-polish, Property 3: Text Selection Transfer**
 * **Validates: Requirements 5.2**
 * 
 * For any text selection in the source textarea (where selectionStart < selectionEnd),
 * clicking a copy-to-field button SHALL transfer exactly the substring from
 * selectionStart to selectionEnd into the corresponding target field.
 */
describe('Property 3: Text Selection Transfer', () => {
  test('getSelectedText returns exact substring for valid selection', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1000 }),
        fc.nat(),
        fc.nat(),
        (text, start, end) => {
          // Ensure valid selection bounds
          const validStart = Math.min(start % (text.length + 1), text.length);
          const validEnd = Math.min(end % (text.length + 1), text.length);
          const [selStart, selEnd] = validStart <= validEnd 
            ? [validStart, validEnd] 
            : [validEnd, validStart];

          // Create mock textarea
          const mockTextarea = {
            value: text,
            selectionStart: selStart,
            selectionEnd: selEnd,
          } as HTMLTextAreaElement;

          const result = getSelectedText(mockTextarea);
          
          // Should return exact substring
          expect(result).toBe(text.substring(selStart, selEnd));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getSelectedText returns empty string when no selection (start === end)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        fc.nat(),
        (text, position) => {
          const validPosition = text.length > 0 ? position % text.length : 0;

          const mockTextarea = {
            value: text,
            selectionStart: validPosition,
            selectionEnd: validPosition,
          } as HTMLTextAreaElement;

          const result = getSelectedText(mockTextarea);
          expect(result).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Selection at boundaries works correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (text) => {
          // Test full selection
          const fullSelect = {
            value: text,
            selectionStart: 0,
            selectionEnd: text.length,
          } as HTMLTextAreaElement;
          expect(getSelectedText(fullSelect)).toBe(text);

          // Test selection from start
          if (text.length > 1) {
            const halfSelect = {
              value: text,
              selectionStart: 0,
              selectionEnd: Math.floor(text.length / 2),
            } as HTMLTextAreaElement;
            expect(getSelectedText(halfSelect)).toBe(text.substring(0, Math.floor(text.length / 2)));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: v3.1-bugfix-ux-polish, Property 4: Focus Sequencing After Paste**
 * **Validates: Requirements 5.3**
 * 
 * For any target field in the sequence [stem, optionA, optionB, optionC, explanation],
 * after pasting text into that field, focus SHALL move to the next field in the
 * sequence (or remain on explanation if already at the end).
 */
describe('Property 4: Focus Sequencing After Paste', () => {
  test('getNextField returns correct next field for all fields except last', () => {
    // Test each field in sequence
    expect(getNextField('stem')).toBe('optionA');
    expect(getNextField('optionA')).toBe('optionB');
    expect(getNextField('optionB')).toBe('optionC');
    expect(getNextField('optionC')).toBe('explanation');
    expect(getNextField('explanation')).toBe(null);
  });

  test('getNextField returns null for last field in sequence', () => {
    const lastField = FIELD_SEQUENCE[FIELD_SEQUENCE.length - 1];
    expect(getNextField(lastField)).toBe(null);
  });

  test('Field sequence is correctly ordered', () => {
    expect(FIELD_SEQUENCE).toEqual(['stem', 'optionA', 'optionB', 'optionC', 'explanation']);
  });

  test('For any field except last, next field is the subsequent element in sequence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: FIELD_SEQUENCE.length - 2 }),
        (index) => {
          const currentField = FIELD_SEQUENCE[index];
          const expectedNext = FIELD_SEQUENCE[index + 1];
          expect(getNextField(currentField)).toBe(expectedNext);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Sequence contains exactly 5 fields', () => {
    expect(FIELD_SEQUENCE.length).toBe(5);
  });

  test('All fields in sequence are unique', () => {
    const uniqueFields = new Set(FIELD_SEQUENCE);
    expect(uniqueFields.size).toBe(FIELD_SEQUENCE.length);
  });
});
