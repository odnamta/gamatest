'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function TakeAssessmentError({ error, reset }: ErrorProps) {
  const router = useRouter()

  useEffect(() => {
    console.error('Exam error:', error)
  }, [error])

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-5">
        <AlertTriangle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Exam Interrupted
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
        An error occurred during your exam. Don&apos;t worry — your answers have been saved automatically.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Click &quot;Resume Exam&quot; to pick up where you left off.
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Resume Exam
        </Button>
        <Button variant="secondary" onClick={() => router.push('/assessments')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assessments
        </Button>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-slate-400">Error ID: {error.digest}</p>
      )}
    </div>
  )
}
