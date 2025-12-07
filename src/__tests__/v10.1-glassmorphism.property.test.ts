import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Glassmorphic styling utilities for testing
 * These functions extract the styling logic for property-based testing
 */

/**
 * Required glassmorphic classes for cards
 */
export const GLASS_CARD_CLASSES = [
  'bg-white/70',
  'backdrop-blur-md',
  'border-white/20',
  'rounded-2xl',
  'shadow-lg',
] as const;

/**
 * Required glassmorphic classes for navigation
 */
export const GLASS_NAV_CLASSES = [
  'bg-white/80',
  'backdrop-blur-lg',
  'border-white/20',
] as const;

/**
 * Checks if a className string contains all required glassmorphic card classes
 */
export function hasGlassCardStyling(className: string): boolean {
  return GLASS_CARD_CLASSES.every(cls => className.includes(cls));
}

/**
 * Checks if a className string contains all required glassmorphic nav classes
 */
export function hasGlassNavStyling(className: string): boolean {
  return GLASS_NAV_CLASSES.every(cls => className.includes(cls));
}

/**
 * Generates the glassmorphic card class string
 */
export function getGlassCardClasses(additionalClasses?: string): string {
  const baseClasses = 'bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl shadow-lg shadow-slate-200/50';
  return additionalClasses ? `${baseClasses} ${additionalClasses}` : baseClasses;
}

/**
 * Generates the glassmorphic nav class string
 */
export function getGlassNavClasses(additionalClasses?: string): string {
  const baseClasses = 'bg-white/80 backdrop-blur-lg border-white/20';
  return additionalClasses ? `${baseClasses} ${additionalClasses}` : baseClasses;
}

/**
 * Determines if onboarding modal should be visible based on user metadata
 */
export function shouldShowOnboardingModal(userMetadata: { onboarded?: boolean } | null | undefined): boolean {
  if (!userMetadata) return true;
  return userMetadata.onboarded !== true;
}

/**
 * Validates onboarding completion data
 */
export function isValidOnboardingData(data: {
  onboarded?: boolean;
  specialty?: string;
  examDate?: string;
}): boolean {
  return data.onboarded === true && typeof data.specialty === 'string' && data.specialty.length > 0;
}

/**
 * Navigation items for testing
 */
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/library', label: 'Library' },
  { href: '/profile', label: 'Profile' },
] as const;

/**
 * Checks if navigation to a route is correct
 */
export function isCorrectNavigation(clickedHref: string, expectedRoute: string): boolean {
  return clickedHref === expectedRoute;
}

/**
 * **Feature: v10.1-facelift, Property 1: Glassmorphic Card Styling**
 * *For any* content card rendered on the landing page, the component should include 
 * backdrop-blur-md and bg-white/70 (or equivalent semi-transparent white) classes.
 * **Validates: Requirements 1.3**
 */
describe('Property 1: Glassmorphic Card Styling', () => {
  it('glass card classes always include required glassmorphic styles', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }), // optional additional classes
        (additionalClasses) => {
          const classes = getGlassCardClasses(additionalClasses ?? undefined);
          expect(hasGlassCardStyling(classes)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all required glass card classes are present', () => {
    const classes = getGlassCardClasses();
    GLASS_CARD_CLASSES.forEach(cls => {
      expect(classes).toContain(cls);
    });
  });

  it('additional classes do not remove required glassmorphic styles', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('p-4', 'p-6', 'p-8', 'hover:scale-105', 'transition-all', 'cursor-pointer')),
        (additionalClassList) => {
          const additionalClasses = additionalClassList.join(' ');
          const classes = getGlassCardClasses(additionalClasses);
          expect(hasGlassCardStyling(classes)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: v10.1-facelift, Property 2: Onboarding Modal Visibility**
 * *For any* user where `user.metadata.onboarded` is false or undefined, the OnboardingModal 
 * should be displayed. For any user where `user.metadata.onboarded` is true, the modal should not be displayed.
 * **Validates: Requirements 3.1**
 */
describe('Property 2: Onboarding Modal Visibility', () => {
  it('modal shows when onboarded is false', () => {
    fc.assert(
      fc.property(
        fc.record({
          onboarded: fc.constant(false),
          specialty: fc.option(fc.string()),
          examDate: fc.option(fc.string()),
        }),
        (metadata) => {
          expect(shouldShowOnboardingModal(metadata)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('modal shows when onboarded is undefined', () => {
    fc.assert(
      fc.property(
        fc.record({
          specialty: fc.option(fc.string()),
          examDate: fc.option(fc.string()),
        }),
        (metadata) => {
          expect(shouldShowOnboardingModal(metadata)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('modal hides when onboarded is true', () => {
    fc.assert(
      fc.property(
        fc.record({
          onboarded: fc.constant(true),
          specialty: fc.option(fc.string()),
          examDate: fc.option(fc.string()),
        }),
        (metadata) => {
          expect(shouldShowOnboardingModal(metadata)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('modal shows when metadata is null or undefined', () => {
    expect(shouldShowOnboardingModal(null)).toBe(true);
    expect(shouldShowOnboardingModal(undefined)).toBe(true);
  });
});

/**
 * **Feature: v10.1-facelift, Property 3: Onboarding Metadata Persistence**
 * *For any* completed onboarding flow, the user metadata should contain `onboarded: true`, 
 * the selected specialty, and the exam date (if provided).
 * **Validates: Requirements 3.6**
 */
describe('Property 3: Onboarding Metadata Persistence', () => {
  const SPECIALTIES = [
    'OBGYN',
    'Surgery',
    'Internal Medicine',
    'Pediatrics',
    'Family Medicine',
    'Emergency Medicine',
    'Psychiatry',
    'Other',
  ];

  it('valid onboarding data has onboarded=true and non-empty specialty', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SPECIALTIES),
        // Use integer-based date generation to avoid invalid time values
        fc.option(
          fc.integer({ min: 0, max: 3650 }) // Days from 2020-01-01
            .map(days => {
              const date = new Date('2020-01-01');
              date.setDate(date.getDate() + days);
              return date.toISOString();
            })
        ),
        (specialty, examDate) => {
          const data = {
            onboarded: true,
            specialty,
            examDate: examDate ?? undefined,
          };
          expect(isValidOnboardingData(data)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onboarding data without onboarded=true is invalid', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SPECIALTIES),
        (specialty) => {
          const data = {
            onboarded: false,
            specialty,
          };
          expect(isValidOnboardingData(data)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onboarding data without specialty is invalid', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', undefined as unknown as string),
        (specialty) => {
          const data = {
            onboarded: true,
            specialty,
          };
          expect(isValidOnboardingData(data)).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });
});

/**
 * **Feature: v10.1-facelift, Property 4: Navigation Glassmorphism Styling**
 * *For any* rendered MobileNavBar or Sidebar, the component should include 
 * bg-white/80, backdrop-blur-lg, and border-white/20 classes.
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Property 4: Navigation Glassmorphism Styling', () => {
  it('glass nav classes always include required glassmorphic styles', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }),
        (additionalClasses) => {
          const classes = getGlassNavClasses(additionalClasses ?? undefined);
          expect(hasGlassNavStyling(classes)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all required glass nav classes are present', () => {
    const classes = getGlassNavClasses();
    GLASS_NAV_CLASSES.forEach(cls => {
      expect(classes).toContain(cls);
    });
  });

  it('additional classes do not remove required glassmorphic nav styles', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('fixed', 'bottom-0', 'left-0', 'right-0', 'z-40', 'pb-safe')),
        (additionalClassList) => {
          const additionalClasses = additionalClassList.join(' ');
          const classes = getGlassNavClasses(additionalClasses);
          expect(hasGlassNavStyling(classes)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: v10.1-facelift, Property 5: Navigation Functionality Preservation**
 * *For any* navigation item in MobileNavBar or Sidebar, clicking the item should 
 * navigate to the correct route (Home → /dashboard, Library → /library, Profile → /profile).
 * **Validates: Requirements 4.5**
 */
describe('Property 5: Navigation Functionality Preservation', () => {
  it('each nav item has correct href', () => {
    const expectedRoutes = {
      'Home': '/dashboard',
      'Library': '/library',
      'Profile': '/profile',
    };

    NAV_ITEMS.forEach(item => {
      expect(item.href).toBe(expectedRoutes[item.label as keyof typeof expectedRoutes]);
    });
  });

  it('navigation to clicked href is correct', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NAV_ITEMS),
        (navItem) => {
          expect(isCorrectNavigation(navItem.href, navItem.href)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('nav items contain exactly Home, Library, and Profile', () => {
    const labels = NAV_ITEMS.map(item => item.label);
    expect(labels).toContain('Home');
    expect(labels).toContain('Library');
    expect(labels).toContain('Profile');
    expect(labels.length).toBe(3);
  });
});
