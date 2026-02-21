'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RoleDetailError({ error, reset }: ErrorProps) {
  const router = useRouter()

  useEffect(() => {
    console.error('Role detail error:', error)
  }, [error])

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-5">
        <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        An error occurred while loading this role profile. Please try again.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button variant="secondary" onClick={() => router.push('/skills')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Skills
        </Button>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-slate-400">Error ID: {error.digest}</p>
      )}
    </div>
  )
}
