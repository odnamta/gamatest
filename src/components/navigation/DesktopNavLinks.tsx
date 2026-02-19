'use client'

/**
 * V17: Desktop navigation links with badge counts.
 * V19: Assessment-first navigation. Assessments + Skills always visible.
 */

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useOrg } from '@/components/providers/OrgProvider'
import { getUnreadNotificationCount } from '@/actions/notification-actions'

export function DesktopNavLinks() {
  const pathname = usePathname()
  const { org } = useOrg()
  const isStudyMode = org.settings?.features?.study_mode
  const isSkillsMapping = org.settings?.features?.skills_mapping
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    getUnreadNotificationCount().then((r) => {
      if (r.ok && r.data) setUnreadCount(r.data)
    })
  }, [])

  const links = [
    { href: '/assessments', label: 'Assessments' },
    ...(isSkillsMapping ? [{ href: '/skills', label: 'Skills' }] : []),
    { href: '/library', label: 'Library' },
    ...(isStudyMode ? [{ href: '/library/my', label: 'My Library' }] : []),
  ]

  return (
    <nav className="hidden sm:flex items-center gap-4" aria-label="Main navigation">
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href)
        return (
          <a
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`text-sm font-medium transition-colors ${
              isActive
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {link.label}
          </a>
        )
      })}
    </nav>
  )
}
