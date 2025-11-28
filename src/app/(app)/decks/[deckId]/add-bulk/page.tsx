'use client'

import { useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Textarea } from '@/components/ui/Textarea'
import { BulkImportStepper } from '@/components/cards/BulkImportStepper'
import { TextSelectionToolbar, TargetField, getNextField } from '@/components/cards/TextSelectionToolbar'
import { SourceBar } from '@/components/cards/SourceBar'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Sparkles, Upload } from 'lucide-react'

/**
 * Bulk Import Page - Client Component
 * Enhanced UI for PDF-assisted MCQ creation with text selection helper.
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 7.3, 9.1, 9.4, 10.1, 10.2, 10.3, 10.4
 * 
 * Feature: v3-ux-overhaul
 */
// Linked source state type
interface LinkedSource {
  id: string
  fileName: string
  fileUrl?: string
}

export default function BulkImportPage() {
  const params = useParams()
  const deckId = params.deckId as string
  const { showToast } = useToast()
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1) // Start at step 1 (Upload PDF)
  
  // Linked source state - Requirements 4.1, 4.2, 4.3
  const [linkedSource, setLinkedSource] = useState<LinkedSource | null>(null)
  const [showUploadDropzone, setShowUploadDropzone] = useState(true)

  // MCQ form state - lifted up for toolbar integration
  const [questionStem, setQuestionStem] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [explanation, setExplanation] = useState('')

  // Refs for form fields (for auto-focus)
  const stemRef = useRef<HTMLTextAreaElement>(null)
  const optionRefs = useRef<(HTMLInputElement | null)[]>([])
  const explanationRef = useRef<HTMLTextAreaElement>(null)

  // Handle successful PDF upload
  const handleUploadSuccess = useCallback((source: LinkedSource) => {
    setLinkedSource(source)
    setShowUploadDropzone(false)
    setCurrentStep(2)
    showToast('PDF uploaded successfully!', 'success')
  }, [showToast])

  // Handle change/replace PDF click
  const handleChangeSource = useCallback(() => {
    setShowUploadDropzone(true)
  }, [])

  // Handle copy to field from toolbar - Requirements 5.2, 5.3
  const handleCopyToField = useCallback((field: TargetField, text: string) => {
    switch (field) {
      case 'stem':
        setQuestionStem(text)
        break
      case 'optionA':
        setOptions(prev => { const next = [...prev]; next[0] = text; return next })
        break
      case 'optionB':
        setOptions(prev => { const next = [...prev]; next[1] = text; return next })
        break
      case 'optionC':
        setOptions(prev => { const next = [...prev]; next[2] = text; return next })
        break
      case 'explanation':
        setExplanation(text)
        break
    }
    
    setCurrentStep(3)
    showToast(`Text copied to ${field === 'stem' ? 'Question Stem' : field}!`, 'success')

    // Auto-focus next field - Requirement 5.3
    const nextField = getNextField(field)
    setTimeout(() => {
      if (nextField === 'stem') stemRef.current?.focus()
      else if (nextField === 'optionA') optionRefs.current[0]?.focus()
      else if (nextField === 'optionB') optionRefs.current[1]?.focus()
      else if (nextField === 'optionC') optionRefs.current[2]?.focus()
      else if (nextField === 'explanation') explanationRef.current?.focus()
    }, 50)
  }, [showToast])

  // Handle no selection - Requirement 5.3
  const handleNoSelection = useCallback(() => {
    showToast('Select text in the left box first.', 'error')
  }, [showToast])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

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
        linkedSourceName={linkedSource?.fileName}
        linkedSourceUrl={linkedSource?.fileUrl}
      />

      {/* Source Bar or Upload Dropzone - Requirements 4.1, 4.2, 4.3 */}
      <div className="mb-6">
        {linkedSource && !showUploadDropzone ? (
          <SourceBar
            fileName={linkedSource.fileName}
            fileUrl={linkedSource.fileUrl}
            onChangeClick={handleChangeSource}
          />
        ) : (
          <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/30">
            <div className="text-center">
              <Upload className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-500 mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Upload a PDF to link as source material
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
                This helps track where your MCQs come from
              </p>
              {/* Placeholder upload button - actual upload logic would go here */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  // Simulate upload for now - in real implementation, this would trigger file picker
                  const mockSource: LinkedSource = {
                    id: 'mock-id',
                    fileName: 'Sample-Questions.pdf',
                    fileUrl: undefined
                  }
                  handleUploadSuccess(mockSource)
                }}
              >
                Select PDF File
              </Button>
              {linkedSource && (
                <button
                  type="button"
                  onClick={() => setShowUploadDropzone(false)}
                  className="block mx-auto mt-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

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

      {/* Text Selection Toolbar - Requirements 5.1, 5.2, 5.3 */}
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg">
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3">
          Select text in the PDF area, then click a button to copy it to that field
        </p>
        <TextSelectionToolbar
          textAreaRef={textAreaRef}
          onCopyToField={handleCopyToField}
          onNoSelection={handleNoSelection}
        />
        
        {/* AI Draft placeholder */}
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            disabled
            title="Coming soon"
            className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-400 dark:text-purple-500 border border-purple-200 dark:border-purple-800 cursor-not-allowed text-xs"
          >
            <Sparkles className="w-3 h-3" />
            AI Draft (Coming Soon)
          </Button>
        </div>
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
          
          {/* Inline MCQ form with pre-filled values */}
          <BulkMCQForm 
            deckId={deckId} 
            stem={questionStem}
            setStem={setQuestionStem}
            options={options}
            setOptions={setOptions}
            explanation={explanation}
            setExplanation={setExplanation}
            stemRef={stemRef}
            optionRefs={optionRefs}
            explanationRef={explanationRef}
          />
        </div>
      </div>
    </div>
  )
}

// Inline MCQ form component with controlled state from parent
interface BulkMCQFormProps {
  deckId: string
  stem: string
  setStem: (value: string) => void
  options: string[]
  setOptions: React.Dispatch<React.SetStateAction<string[]>>
  explanation: string
  setExplanation: (value: string) => void
  stemRef: React.RefObject<HTMLTextAreaElement | null>
  optionRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
  explanationRef: React.RefObject<HTMLTextAreaElement | null>
}

function BulkMCQForm({ 
  deckId, 
  stem, 
  setStem, 
  options, 
  setOptions, 
  explanation, 
  setExplanation,
  stemRef,
  optionRefs,
  explanationRef,
}: BulkMCQFormProps) {
  const [correctIndex, setCorrectIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleOptionChange = (index: number, value: string) => {
    setOptions(prev => {
      const newOptions = [...prev]
      newOptions[index] = value
      return newOptions
    })
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
        // Reset form - use parent setters
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
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Question Stem
        </label>
        <textarea
          ref={stemRef}
          name="stem"
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          placeholder="Enter the question or scenario..."
          className="w-full min-h-[100px] px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Options - Dynamic with add/remove */}
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
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-6">
              {String.fromCharCode(65 + index)}.
            </span>
            <input
              ref={el => { optionRefs.current[index] = el }}
              type="text"
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + index)}`}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {/* Remove button - only show if more than 2 options */}
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => {
                  const newOptions = options.filter((_, i) => i !== index)
                  setOptions(newOptions)
                  // Adjust correct index if needed
                  if (correctIndex >= newOptions.length) {
                    setCorrectIndex(newOptions.length - 1)
                  } else if (correctIndex > index) {
                    setCorrectIndex(correctIndex - 1)
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                aria-label={`Remove option ${String.fromCharCode(65 + index)}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        ))}
        
        {/* Add option button - max 10 options */}
        {options.length < 10 && (
          <button
            type="button"
            onClick={() => setOptions([...options, ''])}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            + Add Option
          </button>
        )}
        
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Min 2, max 10 options (A-J)
        </p>
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Explanation (optional)
        </label>
        <textarea
          ref={explanationRef}
          name="explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Explain why the correct answer is correct..."
          className="w-full min-h-[80px] px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding MCQ...' : 'Add MCQ'}
        </Button>
      </div>
    </form>
  )
}
