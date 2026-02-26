'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Error page for the app route group.
 * Displays when an unhandled error occurs in any app page.
 */
export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console (could be sent to error reporting service)
    console.error('App error:', error)
  }, [error])

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Card variant="elevated" padding="lg" className="text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Terjadi kesalahan
        </h1>

        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Terjadi kesalahan tak terduga. Kami akan segera menyelidikinya.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="primary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Coba Lagi
          </Button>

          <Link href="/dashboard">
            <Button variant="secondary">
              <Home className="w-4 h-4 mr-2" />
              Ke Dashboard
            </Button>
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
            Error ID: {error.digest}
          </p>
        )}
      </Card>
    </div>
  )
}
