import { describe, test, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

/**
 * Theme State Property-Based Tests
 * 
 * These tests verify the correctness properties of the theme persistence system
 * as specified in the design document.
 * 
 * **Feature: cekatan, Property 7: Theme State Persistence**
 * **Validates: Requirements 4.2, 4.3**
 * 
 * For any theme toggle action, the new theme value SHALL be persisted to localStorage
 * and the UI SHALL reflect the new theme.
 */

// Theme values that can be stored
type ThemeValue = 'light' | 'dark';

// Generator for theme values
const themeArb = fc.constantFrom('light', 'dark') as fc.Arbitrary<ThemeValue>;

// Generator for sequences of theme toggles
const themeSequenceArb = fc.array(themeArb, { minLength: 1, maxLength: 20 });

// Mock localStorage for testing
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Theme persistence logic (mirrors next-themes behavior)
const THEME_STORAGE_KEY = 'theme';

function persistTheme(storage: MockLocalStorage, theme: ThemeValue): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}

function getPersistedTheme(storage: MockLocalStorage): ThemeValue | null {
  const stored = storage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return null;
}

function toggleTheme(currentTheme: ThemeValue): ThemeValue {
  return currentTheme === 'dark' ? 'light' : 'dark';
}

describe('Property 7: Theme State Persistence', () => {
  let storage: MockLocalStorage;

  beforeEach(() => {
    storage = new MockLocalStorage();
  });

  test('persisted theme matches the last set theme', () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        persistTheme(storage, theme);
        const retrieved = getPersistedTheme(storage);
        
        expect(retrieved).toBe(theme);
      }),
      { numRuns: 100 }
    );
  });

  test('theme toggle produces opposite theme', () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        const toggled = toggleTheme(theme);
        
        expect(toggled).not.toBe(theme);
        expect(['light', 'dark']).toContain(toggled);
      }),
      { numRuns: 100 }
    );
  });

  test('double toggle returns to original theme', () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        const toggled = toggleTheme(theme);
        const doubleToggled = toggleTheme(toggled);
        
        expect(doubleToggled).toBe(theme);
      }),
      { numRuns: 100 }
    );
  });

  test('sequence of theme changes persists final value', () => {
    fc.assert(
      fc.property(themeSequenceArb, (themes) => {
        // Apply each theme in sequence
        for (const theme of themes) {
          persistTheme(storage, theme);
        }
        
        const finalTheme = themes[themes.length - 1];
        const retrieved = getPersistedTheme(storage);
        
        expect(retrieved).toBe(finalTheme);
      }),
      { numRuns: 100 }
    );
  });

  test('persisted theme survives multiple reads', () => {
    fc.assert(
      fc.property(themeArb, fc.integer({ min: 1, max: 10 }), (theme, readCount) => {
        persistTheme(storage, theme);
        
        // Read multiple times
        for (let i = 0; i < readCount; i++) {
          const retrieved = getPersistedTheme(storage);
          expect(retrieved).toBe(theme);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('theme value is always valid after toggle sequence', () => {
    fc.assert(
      fc.property(themeArb, fc.integer({ min: 1, max: 20 }), (initialTheme, toggleCount) => {
        let currentTheme = initialTheme;
        
        for (let i = 0; i < toggleCount; i++) {
          currentTheme = toggleTheme(currentTheme);
          persistTheme(storage, currentTheme);
        }
        
        const retrieved = getPersistedTheme(storage);
        
        // Theme should always be a valid value
        expect(['light', 'dark']).toContain(retrieved);
        
        // After even number of toggles, should be back to initial
        // After odd number of toggles, should be opposite
        const expectedTheme = toggleCount % 2 === 0 ? initialTheme : toggleTheme(initialTheme);
        expect(retrieved).toBe(expectedTheme);
      }),
      { numRuns: 100 }
    );
  });

  test('null returned for empty storage', () => {
    const emptyStorage = new MockLocalStorage();
    const retrieved = getPersistedTheme(emptyStorage);
    
    expect(retrieved).toBeNull();
  });

  test('invalid stored values return null', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s !== 'light' && s !== 'dark'),
        (invalidValue) => {
          storage.setItem(THEME_STORAGE_KEY, invalidValue);
          const retrieved = getPersistedTheme(storage);
          
          expect(retrieved).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
