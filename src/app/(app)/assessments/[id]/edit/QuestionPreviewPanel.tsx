'use client'

/**
 * Question Preview Panel
 * Extracted from edit/page.tsx for code splitting.
 *
 * Shows a sample of questions from the assessment's linked deck.
 * Dynamically imported with { ssr: false } since it's toggled on/off by the user.
 */

import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { getAssessmentPreviewQuestions } from '@/actions/assessment-actions'
import { Button } from '@/components/ui/Button'

interface QuestionPreviewPanelProps {
  assessmentId: string
  totalQuestionCount: number
}

export default function QuestionPreviewPanel({ assessmentId, totalQuestionCount }: QuestionPreviewPanelProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [previewQuestions, setPreviewQuestions] = useState<{ id: string; stem: string; options: string[]; correctIndex: number }[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  async function loadPreview() {
    setPreviewLoading(true)
    setShowPreview(true)
    const result = await getAssessmentPreviewQuestions(assessmentId, 10)
    if (result.ok && result.data) {
      setPreviewQuestions(result.data)
    }
    setPreviewLoading(false)
  }

  return (
    <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Question Preview
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => showPreview ? setShowPreview(false) : loadPreview()}
        >
          {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {showPreview ? 'Hide' : 'Preview Questions'}
        </Button>
      </div>

      {showPreview && (
        <div>
          {previewLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700" />
              ))}
            </div>
          ) : previewQuestions.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No questions found in the linked deck.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setShowAnswers(!showAnswers)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showAnswers ? 'Hide correct answers' : 'Show correct answers'}
                </button>
                <span className="text-xs text-slate-400">
                  Showing {previewQuestions.length} of {totalQuestionCount} questions
                </span>
              </div>
              <div className="space-y-3">
                {previewQuestions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                      <span className="text-slate-400 mr-1">{qIdx + 1}.</span>
                      {q.stem}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded ${
                            showAnswers && oIdx === q.correctIndex
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-green-300 dark:ring-green-700'
                              : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {showAnswers && oIdx === q.correctIndex && (
                            <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="font-medium mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
