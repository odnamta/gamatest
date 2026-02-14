'use client'

/**
 * V13: Organization Creation Page
 *
 * First-time users are redirected here to create their organization.
 * Also accessible to existing users who want to create additional orgs.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { createOrganization } from '@/actions/org-actions'

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'callback', 'dashboard', 'decks', 'help',
  'invite', 'join', 'library', 'login', 'logout', 'notifications', 'orgs',
  'privacy', 'profile', 'settings', 'signup', 'stats', 'study', 'support',
  'terms', 'www',
])

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function CreateOrgPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugEdited) {
      setSlug(slugify(value))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    if (slug.length < 3) {
      setError('URL slug must be at least 3 characters')
      return
    }

    if (RESERVED_SLUGS.has(slug)) {
      setError('This slug is reserved and cannot be used')
      return
    }

    startTransition(async () => {
      const result = await createOrganization(name.trim(), slug)
      if (result.ok && result.data) {
        // Set the new org as active
        document.cookie = `gamatest_active_org_id=${result.data.id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
        router.push('/dashboard')
      } else if (!result.ok) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white text-2xl font-bold mb-4">
            G
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Create your organization
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Set up your workspace to start creating assessments and study materials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="org-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Organization name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Gama Logistics"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              maxLength={100}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="org-slug"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              URL slug
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500 dark:text-slate-400">gamatest.com/</span>
              <input
                id="org-slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  setSlugEdited(true)
                }}
                placeholder="gama-logistics"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={50}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={isPending}
            className="w-full"
          >
            Create Organization
          </Button>
        </form>
      </div>
    </div>
  )
}
