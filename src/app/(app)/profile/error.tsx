'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { logger.error('profile.error', error) }, [error])

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Failed to load profile
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        We couldn&apos;t load your profile settings. Please try again.
      </p>
      <Button onClick={reset}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
      {error.digest && (
        <p className="mt-4 text-xs text-slate-400">Error ID: {error.digest}</p>
      )}
    </div>
  )
}
