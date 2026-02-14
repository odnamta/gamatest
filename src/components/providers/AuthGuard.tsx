'use client'

/**
 * V25: Auth Guard Provider
 *
 * Listens for Supabase auth state changes and redirects to login
 * when the session expires. This prevents users from seeing
 * confusing "AUTH_REQUIRED" errors on stale tabs.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          setExpired(true)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (expired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-sm mx-4 text-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Session expired
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Your session has expired. Please log in again to continue.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Log in
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
