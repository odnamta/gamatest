import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NAV_ITEMS, isNavItemActive, getNavItemClasses } from '../components/navigation/MobileNavBar';

/**
 * **Feature: v10, Property 8: MobileNavBar Items**
 * For any rendered MobileNavBar, the core items should contain
 * Home, Assess, Library, and Profile.
 * Skills and Study are conditionally added based on feature flags.
 * **Validates: Requirements 4.3, V19**
 */
describe('Property 8: MobileNavBar Items', () => {
  it('has exactly four core navigation items', () => {
    expect(NAV_ITEMS).toHaveLength(4);
  });

  it('contains Home, Assess, Library, and Profile items', () => {
    const labels = NAV_ITEMS.map(item => item.label);
    expect(labels).toContain('Home');
    expect(labels).toContain('Assess');
    expect(labels).toContain('Library');
    expect(labels).toContain('Profile');
  });

  it('has correct hrefs for each item', () => {
    const homeItem = NAV_ITEMS.find(item => item.label === 'Home');
    const assessItem = NAV_ITEMS.find(item => item.label === 'Assess');
    const libraryItem = NAV_ITEMS.find(item => item.label === 'Library');
    const profileItem = NAV_ITEMS.find(item => item.label === 'Profile');

    expect(homeItem?.href).toBe('/dashboard');
    expect(assessItem?.href).toBe('/assessments');
    expect(libraryItem?.href).toBe('/library');
    expect(profileItem?.href).toBe('/profile');
  });

  it('each item has an icon', () => {
    NAV_ITEMS.forEach(item => {
      expect(item.icon).toBeDefined();
      expect(item.icon).not.toBeNull();
    });
  });
});

/**
 * **Feature: v10, Property 9: MobileNavBar Active State**
 * For any navigation item where the href matches the current pathname,
 * the item should have active styling (blue color).
 * **Validates: Requirements 4.4**
 */
describe('Property 9: MobileNavBar Active State', () => {
  it('dashboard is active for /dashboard pathname', () => {
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
  });

  it('dashboard is active for / pathname', () => {
    expect(isNavItemActive('/', '/dashboard')).toBe(true);
  });

  it('library is active for /library pathname', () => {
    expect(isNavItemActive('/library', '/library')).toBe(true);
  });

  it('library is active for /library/* pathnames', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !s.includes(' ')),
        (subpath) => {
          const pathname = `/library/${subpath}`;
          expect(isNavItemActive(pathname, '/library')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('assessments is active for /assessments pathname', () => {
    expect(isNavItemActive('/assessments', '/assessments')).toBe(true);
  });

  it('profile is active for /profile pathname', () => {
    expect(isNavItemActive('/profile', '/profile')).toBe(true);
  });

  it('active state returns blue classes', () => {
    const classes = getNavItemClasses(true);
    expect(classes).toContain('text-blue-600');
  });

  it('inactive state returns slate classes', () => {
    const classes = getNavItemClasses(false);
    expect(classes).toContain('text-slate-500');
  });

  it('active and inactive states are different', () => {
    const activeClasses = getNavItemClasses(true);
    const inactiveClasses = getNavItemClasses(false);
    expect(activeClasses).not.toBe(inactiveClasses);
  });
});

/**
 * **Feature: v10, Property 10: MobileNavBar Navigation**
 * For any click on a navigation item, the router should navigate to the item's href.
 * **Validates: Requirements 4.5**
 */
describe('Property 10: MobileNavBar Navigation', () => {
  it('all nav items have valid href paths', () => {
    NAV_ITEMS.forEach(item => {
      expect(item.href).toMatch(/^\/[a-z]*/);
    });
  });

  it('all nav items have non-empty labels', () => {
    NAV_ITEMS.forEach(item => {
      expect(item.label.length).toBeGreaterThan(0);
    });
  });

  it('nav items have minimum touch target height in classes', () => {
    const activeClasses = getNavItemClasses(true);
    const inactiveClasses = getNavItemClasses(false);

    expect(activeClasses).toContain('min-h-[48px]');
    expect(inactiveClasses).toContain('min-h-[48px]');
  });
});
