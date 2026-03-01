'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('invite.error', error)
  }, [error])

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Terjadi Kesalahan
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Maaf, terjadi kesalahan yang tidak terduga.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
