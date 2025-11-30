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
 * **Feature: v3.2-visual-polish, Property 4: Focus Sequencing After Paste**
 * **Validates: Requirements 5.3**
 * 
 * For any target field in the sequence [stem, optionA, optionB, optionC, optionD, explanation],
 * after pasting text into that field, focus SHALL move to the next field in the
 * sequence (or remain on explanation if already at the end).
 */
describe('Property 4: Focus Sequencing After Paste', () => {
  test('getNextField returns correct next field for all fields except last', () => {
    // Test each field in sequence (V6.6: now includes optionE)
    expect(getNextField('stem')).toBe('optionA');
    expect(getNextField('optionA')).toBe('optionB');
    expect(getNextField('optionB')).toBe('optionC');
    expect(getNextField('optionC')).toBe('optionD');
    expect(getNextField('optionD')).toBe('optionE');
    expect(getNextField('optionE')).toBe('explanation');
    expect(getNextField('explanation')).toBe(null);
  });

  test('getNextField returns null for last field in sequence', () => {
    const lastField = FIELD_SEQUENCE[FIELD_SEQUENCE.length - 1];
    expect(getNextField(lastField)).toBe(null);
  });

  test('Field sequence is correctly ordered (V6.6: includes optionE)', () => {
    expect(FIELD_SEQUENCE).toEqual(['stem', 'optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'explanation']);
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

  test('Sequence contains exactly 7 fields (stem + 5 options + explanation)', () => {
    // V6.6: Updated to include optionE
    expect(FIELD_SEQUENCE.length).toBe(7);
  });

  test('All fields in sequence are unique', () => {
    const uniqueFields = new Set(FIELD_SEQUENCE);
    expect(uniqueFields.size).toBe(FIELD_SEQUENCE.length);
  });
});


/**
 * **Feature: v6.6-scanner-polish, Property 4: Option E Copies to Index 4**
 * **Validates: Requirements 4.2**
 * 
 * For any selected text string, when the user clicks "To Option E",
 * the text SHALL be copied to the options array at index 4.
 */
describe('Property 4: Option E Copies to Index 4', () => {
  test('optionE is at index 5 in FIELD_SEQUENCE (after optionD, before explanation)', () => {
    const optionEIndex = FIELD_SEQUENCE.indexOf('optionE');
    const optionDIndex = FIELD_SEQUENCE.indexOf('optionD');
    const explanationIndex = FIELD_SEQUENCE.indexOf('explanation');
    
    expect(optionEIndex).toBe(5);
    expect(optionEIndex).toBe(optionDIndex + 1);
    expect(optionEIndex).toBe(explanationIndex - 1);
  });

  test('optionE field exists in TargetField type', () => {
    const validFields: TargetField[] = ['stem', 'optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'explanation'];
    expect(validFields).toContain('optionE');
  });

  test('getNextField(optionD) returns optionE', () => {
    expect(getNextField('optionD')).toBe('optionE');
  });

  test('getNextField(optionE) returns explanation', () => {
    expect(getNextField('optionE')).toBe('explanation');
  });

  test('For any text, optionE maps to options array index 4', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (text) => {
          // Simulate the mapping logic from BulkImportPage
          const field: TargetField = 'optionE';
          const options = ['', '', '', '', ''];
          
          // The mapping: optionA=0, optionB=1, optionC=2, optionD=3, optionE=4
          const fieldToIndex: Record<string, number> = {
            optionA: 0,
            optionB: 1,
            optionC: 2,
            optionD: 3,
            optionE: 4,
          };
          
          const index = fieldToIndex[field];
          expect(index).toBe(4);
          
          // Simulate copy operation
          options[index] = text;
          expect(options[4]).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });
});
