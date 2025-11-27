'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Textarea } from '@/components/ui/Textarea'
import { BulkImportStepper } from '@/components/cards/BulkImportStepper'
import { TextToStemButton } from '@/components/cards/TextToStemButton'
import { Button } from '@/components/ui/Button'
import { Sparkles } from 'lucide-react'

/**
 * Bulk Import Page - Client Component
 * Enhanced UI for PDF-assisted MCQ creation with text selection helper.
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 7.3, 9.1, 9.4, 10.1, 10.2, 10.3, 10.4
 * 
 * Feature: v3-ux-overhaul
 */
export default function BulkImportPage() {
  const params = useParams()
  const deckId = params.deckId as string
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const [questionStem, setQuestionStem] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(2) // Default to step 2 (Select Text)

  // Show toast message
  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Handle text selection transfer
  const handleTextSelected = (text: string) => {
    setQuestionStem(text)
    setCurrentStep(3)
    showToast('Text copied to Question Stem!')
  }

  // Handle no selection
  const handleNoSelection = () => {
    showToast('Select text in the left box first.')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-lg shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Header with navigation */}
      <div className="mb-6">
        <Link 
          href={`/decks/${deckId}`}
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          ← Back to Deck
        </Link>
      </div>

      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Bulk Import MCQs
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Create MCQs quickly by copying from your PDF source materials.
        </p>
      </div>

      {/* Workflow Stepper - Requirements 4.1, 4.2, 4.3 */}
      <BulkImportStepper 
        currentStep={currentStep}
        linkedSourceName={null} // TODO: Wire up to actual linked source
      />

      {/* Helper Instructions */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          How to use this page
        </h3>
        <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Paste text from your PDF into the left text area</li>
          <li>Select the question text you want to use</li>
          <li>Click the copy button to transfer it to the form</li>
          <li>Fill in the answer options and submit</li>
        </ol>
      </div>

      {/* Action buttons between panels - Requirements 5.1, 5.4 */}
      <div className="mb-6 flex flex-wrap gap-3 justify-center">
        <TextToStemButton
          textAreaRef={textAreaRef}
          onTextSelected={handleTextSelected}
          onNoSelection={handleNoSelection}
        />
        
        {/* AI Draft placeholder - Requirements 5.4, 5.5 */}
        <Button
          type="button"
          variant="ghost"
          disabled
          className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-400 dark:text-purple-500 border border-purple-200 dark:border-purple-800 cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          AI Draft (Coming Soon)
        </Button>
      </div>

      {/* Split-view layout - Requirements 10.1, 10.3, 7.3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side: PDF text paste area */}
        <div className="p-6 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            PDF Text Reference
          </h2>
          
          <textarea
            ref={textAreaRef}
            placeholder="Paste text from your PDF here...

Example:
1. A 32-year-old G2P1 woman at 28 weeks gestation presents with...

A) Option A
B) Option B  
C) Option C
D) Option D

Answer: C

Explanation: The correct answer is C because..."
            className="w-full min-h-[400px] px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-sm resize-y"
            onClick={() => setCurrentStep(2)}
          />
          
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Select text and click the copy button above to transfer it to the form.
          </p>
        </div>

        {/* Right side: MCQ creation form */}
        <div className="p-6 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Create MCQ
          </h2>
          
          {/* Inline MCQ form with pre-filled stem */}
          <BulkMCQForm deckId={deckId} initialStem={questionStem} />
        </div>
      </div>
    </div>
  )
}

// Inline MCQ form component that accepts initial stem
function BulkMCQForm({ deckId, initialStem }: { deckId: string; initialStem: string }) {
  const [stem, setStem] = useState(initialStem)
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctIndex, setCorrectIndex] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Update stem when initialStem changes
  useState(() => {
    if (initialStem) {
      setStem(initialStem)
    }
  })

  // Sync with initialStem prop
  if (initialStem && initialStem !== stem && stem === '') {
    setStem(initialStem)
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('deckId', deckId)
      formData.append('stem', stem)
      formData.append('correctIndex', correctIndex.toString())
      formData.append('explanation', explanation)
      options.forEach((opt, i) => formData.append(`option_${i}`, opt))

      const { createMCQAction } = await import('@/actions/mcq-actions')
      const result = await createMCQAction({ success: true }, formData)

      if (result.success) {
        setMessage({ type: 'success', text: 'MCQ created successfully!' })
        // Reset form
        setStem('')
        setOptions(['', '', '', ''])
        setCorrectIndex(0)
        setExplanation('')
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to create MCQ' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Stem */}
      <Textarea
        label="Question Stem"
        name="stem"
        value={stem}
        onChange={(e) => setStem(e.target.value)}
        placeholder="Enter the question or scenario..."
      />

      {/* Options */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Answer Options
        </label>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="radio"
              checked={correctIndex === index}
              onChange={() => setCorrectIndex(index)}
              className="w-4 h-4 text-blue-600"
            />
            <input
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {/* Explanation */}
      <Textarea
        label="Explanation (optional)"
        name="explanation"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="Explain why the correct answer is correct..."
      />

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding MCQ...' : 'Add MCQ'}
        </Button>
      </div>
    </form>
  )
}
