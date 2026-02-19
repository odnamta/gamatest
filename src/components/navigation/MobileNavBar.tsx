'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Library, User, BarChart3, ClipboardCheck, Target } from 'lucide-react';
import { ReactNode, useState, useEffect } from 'react';
import { useOrg } from '@/components/providers/OrgProvider';
import { getUnreadNotificationCount } from '@/actions/notification-actions';

export interface NavItem {
  href: string;
  icon: ReactNode;
  label: string;
}

/**
 * Core navigation items for the mobile nav bar
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: <Home className="h-5 w-5" />, label: 'Home' },
  { href: '/assessments', icon: <ClipboardCheck className="h-5 w-5" />, label: 'Assess' },
  { href: '/library', icon: <Library className="h-5 w-5" />, label: 'Library' },
  { href: '/profile', icon: <User className="h-5 w-5" />, label: 'Profile' },
];

/**
 * Determines if a nav item is active based on current pathname
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/';
  }
  return pathname.startsWith(href);
}

/**
 * Returns the CSS classes for a nav item based on active state
 */
export function getNavItemClasses(isActive: boolean): string {
  const baseClasses = 'flex flex-col items-center justify-center py-2 px-3 transition-colors min-h-[48px]';
  const activeClasses = 'text-blue-600';
  const inactiveClasses = 'text-slate-500 hover:text-slate-700';

  return `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;
}

export interface MobileNavBarProps {
  className?: string;
}

/**
 * Glassmorphic navigation classes for property testing
 */
export const GLASS_NAV_CLASSES = 'bg-white/80 backdrop-blur-lg border-t border-white/20';

export function MobileNavBar({ className = '' }: MobileNavBarProps) {
  const pathname = usePathname();
  const { org } = useOrg();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadNotificationCount().then((r) => {
      if (r.ok && r.data) setUnreadCount(r.data);
    });
  }, []);

  const items = [...NAV_ITEMS];

  // Add Skills nav if feature is enabled
  if (org.settings?.features?.skills_mapping) {
    items.splice(2, 0, {
      href: '/skills',
      icon: <Target className="h-5 w-5" />,
      label: 'Skills',
    });
  }

  // Add Study nav if study mode is enabled
  if (org.settings?.features?.study_mode) {
    items.splice(items.length - 1, 0, {
      href: '/stats',
      icon: <BarChart3 className="h-5 w-5" />,
      label: 'Study',
    });
  }

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 ${GLASS_NAV_CLASSES} md:hidden z-40 pb-safe ${className}`}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={getNavItemClasses(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative">
                {item.icon}
                {item.href === '/dashboard' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNavBar;
