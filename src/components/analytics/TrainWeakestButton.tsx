'use client'

import Link from 'next/link'
import { Zap, AlertCircle } from 'lucide-react'
import type { TopicAccuracy } from '@/types/database'
import { generateTrainUrl } from '@/lib/analytics-utils'

interface TrainWeakestButtonProps {
  topic: TopicAccuracy | null
  disabled?: boolean
}

/**
 * TrainWeakestButton provides a quick action to start studying the weakest topic.
 * Navigates to a custom study session filtered by the weakest topic's tag ID.
 * 
 * Requirements: 4.1, 4.2, 4.4
 */
export function TrainWeakestButton({ topic, disabled = false }: TrainWeakestButtonProps) {
  // No topic or insufficient data - show encouraging message
  if (!topic || disabled) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <AlertCircle className="h-5 w-5 text-slate-400" />
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Keep studying!
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Complete more reviews to unlock targeted training recommendations.
          </p>
        </div>
      </div>
    )
  }

  const trainUrl = generateTrainUrl(topic.tagId)

  return (
    <Link
      href={trainUrl}
      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-lg transition-all shadow-md hover:shadow-lg group"
    >
      <div className="p-1.5 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
        <Zap className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">
          Train Weakest Topic
        </p>
        <p className="text-xs text-white/80">
          {topic.tagName} • {topic.accuracy?.toFixed(0) ?? 0}% accuracy
        </p>
      </div>
    </Link>
  )
}

export default TrainWeakestButton
