'use client'

import { useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { BulkImportStepper } from '@/components/cards/BulkImportStepper'
import { TextSelectionToolbar, TargetField, getNextField } from '@/components/cards/TextSelectionToolbar'
import { SourceBar } from '@/components/cards/SourceBar'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { Sparkles, Upload, Loader2, Layers } from 'lucide-react'
import { draftMCQFromText } from '@/actions/ai-actions'
import { draftBatchMCQFromText } from '@/actions/batch-mcq-actions'
import { RATE_LIMIT_MS } from '@/lib/ai-config'
import { SelectionTooltip } from '@/components/pdf/SelectionTooltip'
import { uploadSourceAction } from '@/actions/source-actions'
import { useSessionTags } from '@/hooks/use-session-tags'
import { TagSelector } from '@/components/tags/TagSelector'
import { BatchReviewPanel } from '@/components/batch/BatchReviewPanel'
import { toUIFormatArray, type MCQBatchDraftUI } from '@/lib/batch-mcq-schema'
import { useHotkeys, getPlatformModifier } from '@/hooks/use-hotkeys'

// Dynamic import PDFViewer to avoid SSR issues with react-pdf (DOMMatrix not defined)
const PDFViewer = dynamic(
  () => import('@/components/pdf/PDFViewer').then(mod => ({ default: mod.PDFViewer })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-100 dark:bg-slate-800/50 rounded-lg">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Loading PDF viewer...</p>
      </div>
    )
  }
)

/**
 * Bulk Import Page - Client Component
 * Enhanced UI for PDF-assisted MCQ creation with text selection helper.
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 7.3, 9.1, 9.4, 10.1, 10.2, 10.3, 10.4
 * 
 * Feature: v3-ux-overhaul, v4-ai-brain
 */
// Linked source state type
interface LinkedSource {
  id: string
  fileName: string
  fileUrl?: string
}

// Selection state for PDF tooltip
interface SelectionState {
  text: string
  position: { x: number; y: number }
}

export default function BulkImportPage() {
  const params = useParams()
  const deckId = params.deckId as string
  const { showToast } = useToast()
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1) // Start at step 1 (Upload PDF)
  
  // Linked source state - Requirements 4.1, 4.2, 4.3
  const [linkedSource, setLinkedSource] = useState<LinkedSource | null>(null)
  const [showUploadDropzone, setShowUploadDropzone] = useState(true)
  
  // PDF upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PDF selection state - Requirements V5 2.7, 2.11
  const [pdfSelection, setPdfSelection] = useState<SelectionState | null>(null)

  // MCQ form state - lifted up for toolbar integration
  const [questionStem, setQuestionStem] = useState('')
  const [options, setOptions] = useState(['', '', '', '', '']) // 5 options for AI compatibility
  const [explanation, setExplanation] = useState('')
  const [correctIndex, setCorrectIndex] = useState(0)

  // AI Draft state - Requirements FR-1, FR-5.2
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastGenerateTime, setLastGenerateTime] = useState(0)

  // V6: Session Tags - Requirements R2.1
  const { sessionTagIds, setSessionTagIds, sessionTagNames, isLoading: isLoadingTags } = useSessionTags(deckId)

  // V6: Batch AI Draft state - Requirements R1.1, R1.3
  const [batchDrafts, setBatchDrafts] = useState<MCQBatchDraftUI[]>([])
  const [isBatchPanelOpen, setIsBatchPanelOpen] = useState(false)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [lastBatchTime, setLastBatchTime] = useState(0)

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
    setPdfSelection(null)
    setUploadError(null)
  }, [])

  // Handle file selection and upload - Requirements 9.1, 9.2
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    
    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    // If no file selected (user cancelled), do nothing
    if (!file) return
    
    // Validate it's a real File object
    if (!(file instanceof File)) {
      setUploadError('Invalid file selected')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.pdf$/i, ''))
      formData.append('deckId', deckId)

      const result = await uploadSourceAction(formData)

      if (!result.success) {
        setUploadError(result.error || 'Upload failed')
      } else if (result.data) {
        // Only set linked source and show success on actual upload completion
        const source = result.data as { id: string; title: string; file_url?: string }
        handleUploadSuccess({
          id: source.id,
          fileName: file.name,
          fileUrl: source.file_url,
        })
      }
    } catch (err) {
      console.error('PDF upload error:', err)
      let errorMessage = 'An unexpected error occurred'
      if (err instanceof Error) {
        if (err.message.includes('Body exceeded') || err.message.includes('413')) {
          errorMessage = 'File too large. Maximum size is 50MB.'
        } else if (err.message.includes('Failed to fetch') || err.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else {
          errorMessage = err.message
        }
      }
      setUploadError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }, [deckId, handleUploadSuccess])

  // Handle upload button click - just opens file picker
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Handle PDF text selection - Requirements V5 2.7
  const handlePdfTextSelect = useCallback((text: string, position: { x: number; y: number }) => {
    setPdfSelection({ text, position })
  }, [])

  // Scroll to form on mobile - Requirements V5 2.6
  const scrollToForm = useCallback(() => {
    if (window.innerWidth < 1024 && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Handle "To Stem" from PDF selection - Requirements V5 2.8
  const handlePdfToStem = useCallback(() => {
    if (pdfSelection) {
      setQuestionStem(pdfSelection.text)
      setCurrentStep(3)
      showToast('Text copied to Question Stem!', 'success')
      scrollToForm()
      setTimeout(() => stemRef.current?.focus(), 100)
    }
  }, [pdfSelection, showToast, scrollToForm])

  // Handle "To Explanation" from PDF selection - Requirements V5 2.9
  const handlePdfToExplanation = useCallback(() => {
    if (pdfSelection) {
      setExplanation(pdfSelection.text)
      setCurrentStep(3)
      showToast('Text copied to Explanation!', 'success')
      scrollToForm()
      setTimeout(() => explanationRef.current?.focus(), 100)
    }
  }, [pdfSelection, showToast, scrollToForm])

  // Handle "To AI Draft" from PDF selection - Requirements V5 2.10
  const handlePdfToAIDraft = useCallback(async () => {
    if (!pdfSelection) return
    
    const selectedText = pdfSelection.text
    
    // Check rate limit
    const now = Date.now()
    if (now - lastGenerateTime < RATE_LIMIT_MS) {
      showToast('Please wait a moment before generating again', 'error')
      return
    }

    setIsGenerating(true)
    setLastGenerateTime(now)
    scrollToForm()

    try {
      const result = await draftMCQFromText({
        sourceText: selectedText,
        deckId,
        deckName: linkedSource?.fileName?.replace('.pdf', ''),
      })

      if (result.ok) {
        setQuestionStem(result.draft.stem)
        setOptions(result.draft.options)
        setCorrectIndex(result.draft.correct_index)
        setExplanation(result.draft.explanation)
        setCurrentStep(3)
        showToast('MCQ draft generated! Review and edit before saving.', 'success')
      } else {
        switch (result.error) {
          case 'TEXT_TOO_SHORT':
            showToast('Please select a longer paragraph (at least 50 characters)', 'error')
            break
          case 'NOT_CONFIGURED':
            showToast('AI is not configured yet. Please set OPENAI_API_KEY in .env.local', 'error')
            break
          default:
            showToast('Something went wrong. Please try again.', 'error')
        }
      }
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }, [pdfSelection, lastGenerateTime, deckId, linkedSource?.fileName, showToast, scrollToForm])

  // Close PDF selection tooltip - Requirements V5 2.11, 2.12
  const handleClosePdfSelection = useCallback(() => {
    setPdfSelection(null)
  }, [])

  // V6: Handle "AI Batch Draft" from PDF selection - Requirements R1.1
  const handlePdfToAIBatch = useCallback(async () => {
    if (!pdfSelection) return
    
    const selectedText = pdfSelection.text
    
    // Check rate limit
    const now = Date.now()
    if (now - lastBatchTime < RATE_LIMIT_MS) {
      showToast('Please wait a moment before generating again', 'error')
      return
    }

    setIsBatchGenerating(true)
    setLastBatchTime(now)
    setPdfSelection(null) // Close tooltip

    try {
      const result = await draftBatchMCQFromText({
        deckId,
        text: selectedText,
        defaultTags: sessionTagNames,
      })

      if (result.ok) {
        if (result.drafts.length === 0) {
          showToast('No MCQs found in selected text. Try selecting different content.', 'info')
        } else {
          const uiDrafts = toUIFormatArray(result.drafts)
          setBatchDrafts(uiDrafts)
          setIsBatchPanelOpen(true)
          showToast(`Generated ${result.drafts.length} MCQ drafts!`, 'success')
        }
      } else {
        showToast(result.error.message || 'Failed to generate drafts', 'error')
      }
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setIsBatchGenerating(false)
    }
  }, [pdfSelection, lastBatchTime, deckId, sessionTagNames, showToast])

  // V6: Handle batch save success - Requirements R1.4
  const handleBatchSaveSuccess = useCallback((_count: number) => {
    setBatchDrafts([])
    setIsBatchPanelOpen(false)
    // Focus PDF viewer container after save
    pdfContainerRef.current?.focus()
  }, [])

  // Ref for PDF viewer container (for focus management) - Requirements R3.2
  const pdfContainerRef = useRef<HTMLDivElement>(null)

  // V6: Hotkeys integration - Requirements R3.1, R3.2
  const platformMod = getPlatformModifier()
  
  // Handler for single-card submit via hotkey
  const handleHotkeySubmit = useCallback(() => {
    // Find and click the submit button in the form
    const submitBtn = formRef.current?.querySelector('button[type="submit"]') as HTMLButtonElement | null
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click()
    }
  }, [])

  // Handler for batch draft via hotkey
  const handleHotkeyBatchDraft = useCallback(() => {
    if (pdfSelection?.text) {
      handlePdfToAIBatch()
    } else {
      showToast('Select text in the PDF first to use AI Batch Draft', 'info')
    }
  }, [pdfSelection?.text, handlePdfToAIBatch, showToast])

  // Handler for Escape key
  const handleHotkeyEscape = useCallback(() => {
    if (isBatchPanelOpen) {
      setIsBatchPanelOpen(false)
    } else if (pdfSelection) {
      setPdfSelection(null)
    }
  }, [isBatchPanelOpen, pdfSelection])

  useHotkeys([
    {
      // Cmd/Ctrl+Enter → submit single-card form
      key: 'Enter',
      modifiers: [platformMod],
      handler: handleHotkeySubmit,
      enabled: !isBatchPanelOpen,
    },
    {
      // Shift+Cmd/Ctrl+Enter → trigger batch draft
      key: 'Enter',
      modifiers: ['shift', platformMod],
      handler: handleHotkeyBatchDraft,
      enabled: !isBatchPanelOpen && !isBatchGenerating,
    },
    {
      // Escape → close batch panel or clear selection tooltip
      key: 'Escape',
      handler: handleHotkeyEscape,
      enabled: true,
    },
  ])

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
      case 'optionD':
        setOptions(prev => { const next = [...prev]; next[3] = text; return next })
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
      else if (nextField === 'optionD') optionRefs.current[3]?.focus()
      else if (nextField === 'explanation') explanationRef.current?.focus()
    }, 50)
  }, [showToast])

  // Handle no selection - Requirement 5.3
  const handleNoSelection = useCallback(() => {
    showToast('Select text in the left box first.', 'error')
  }, [showToast])

  // Handle AI Draft button click - Requirements FR-1, FR-4, FR-5
  const handleAIDraft = useCallback(async () => {
    // Check if text is selected (FR-1.1, FR-4.3)
    const selectedText = textAreaRef.current
      ? textAreaRef.current.value.substring(
          textAreaRef.current.selectionStart,
          textAreaRef.current.selectionEnd
        )
      : ''

    if (!selectedText.trim()) {
      showToast('Please select some text first', 'error')
      return
    }

    // Check rate limit (FR-5.2)
    const now = Date.now()
    if (now - lastGenerateTime < RATE_LIMIT_MS) {
      showToast('Please wait a moment before generating again', 'error')
      return
    }

    // Start generation (FR-1.2, FR-1.3)
    setIsGenerating(true)
    setLastGenerateTime(now)

    try {
      const result = await draftMCQFromText({
        sourceText: selectedText,
        deckId,
        deckName: linkedSource?.fileName?.replace('.pdf', ''),
      })

      if (result.ok) {
        // Populate form with draft (FR-3.1, FR-3.2, FR-3.3)
        setQuestionStem(result.draft.stem)
        setOptions(result.draft.options)
        setCorrectIndex(result.draft.correct_index)
        setExplanation(result.draft.explanation)
        setCurrentStep(3)
        showToast('MCQ draft generated! Review and edit before saving.', 'success')
      } else {
        // Show error toast based on error type (FR-4.1, FR-4.2)
        switch (result.error) {
          case 'TEXT_TOO_SHORT':
            showToast('Please select a longer paragraph (at least 50 characters)', 'error')
            break
          case 'NOT_CONFIGURED':
            showToast('AI is not configured yet. Please set OPENAI_API_KEY in .env.local', 'error')
            break
          case 'OPENAI_ERROR':
          case 'PARSE_ERROR':
            showToast('Something went wrong. Please try again.', 'error')
            break
        }
      }
    } catch {
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }, [deckId, linkedSource?.fileName, lastGenerateTime, showToast])

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
              {/* Hidden file input for PDF selection */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload PDF file"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleUploadClick}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Select PDF File'
                )}
              </Button>
              {uploadError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                  {uploadError}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                PDF files only, max 50MB
              </p>
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

      {/* V6: Session Tags Selector - Requirements R2.1 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Session Tags
          <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
            Applied to all cards created from this page
          </span>
        </label>
        {isLoadingTags ? (
          <div className="h-[42px] bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        ) : (
          <TagSelector
            selectedTagIds={sessionTagIds}
            onChange={setSessionTagIds}
          />
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
        
        {/* AI Draft Buttons - Requirements FR-1, FR-5, R1.1 */}
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isGenerating}
              onClick={handleAIDraft}
              className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  AI Draft
                </>
              )}
            </Button>
            {/* V6: AI Batch Draft Button - Requirements R1.1 */}
            <Button
              type="button"
              variant="secondary"
              disabled={isBatchGenerating}
              onClick={handlePdfToAIBatch}
              className="flex items-center gap-2 text-xs"
              title="Generate up to 5 MCQs from selected text"
            >
              {isBatchGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Batch...
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3" />
                  AI Batch Draft
                </>
              )}
            </Button>
          </div>
          {/* Helper text - Requirement FR-5.1, FR-5.3 */}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI Draft: 1 MCQ | AI Batch Draft: up to 5 MCQs
          </p>
        </div>
      </div>

      {/* Split-view layout - Requirements 10.1, 10.3, 7.3, V5 2.5, 2.6 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side: PDF Viewer or text paste area */}
        <div 
          ref={pdfContainerRef}
          tabIndex={-1}
          className="p-6 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {linkedSource?.fileUrl ? (
            /* Integrated PDF Viewer - Requirements V5 2.1-2.4 */
            <>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {linkedSource.fileName}
              </h2>
              <div className="min-h-[500px] lg:min-h-[600px]">
                <PDFViewer
                  fileUrl={linkedSource.fileUrl}
                  fileId={linkedSource.id}
                  onTextSelect={handlePdfTextSelect}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Select text in the PDF to copy it to the form or generate an AI draft.
              </p>
            </>
          ) : (
            /* Fallback: Manual text paste area */
            <>
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
            </>
          )}
        </div>

        {/* Right side: MCQ creation form */}
        <div ref={formRef} className="p-6 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
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
            correctIndex={correctIndex}
            setCorrectIndex={setCorrectIndex}
            explanation={explanation}
            setExplanation={setExplanation}
            stemRef={stemRef}
            optionRefs={optionRefs}
            explanationRef={explanationRef}
            sessionTagIds={sessionTagIds}
            onSaveSuccess={() => pdfContainerRef.current?.focus()}
          />
        </div>
      </div>

      {/* PDF Selection Tooltip - Requirements V5 2.7, 2.11 */}
      {pdfSelection && (
        <SelectionTooltip
          position={pdfSelection.position}
          selectedText={pdfSelection.text}
          onToStem={handlePdfToStem}
          onToExplanation={handlePdfToExplanation}
          onToAIDraft={handlePdfToAIDraft}
          onToAIBatch={handlePdfToAIBatch}
          onClose={handleClosePdfSelection}
        />
      )}

      {/* V6: Batch Review Panel - Requirements R1.3, R1.4 */}
      <BatchReviewPanel
        isOpen={isBatchPanelOpen}
        onClose={() => setIsBatchPanelOpen(false)}
        drafts={batchDrafts}
        onDraftsChange={setBatchDrafts}
        sessionTagIds={sessionTagIds}
        sessionTagNames={sessionTagNames}
        deckId={deckId}
        onSaveSuccess={handleBatchSaveSuccess}
      />
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
  correctIndex: number
  setCorrectIndex: (value: number) => void
  explanation: string
  setExplanation: (value: string) => void
  stemRef: React.RefObject<HTMLTextAreaElement | null>
  optionRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
  explanationRef: React.RefObject<HTMLTextAreaElement | null>
  sessionTagIds?: string[] // V6: Session tags to apply
  onSaveSuccess?: () => void // V6: Callback after successful save for focus management
}

function BulkMCQForm({ 
  deckId, 
  stem, 
  setStem, 
  options, 
  setOptions, 
  correctIndex,
  setCorrectIndex,
  explanation, 
  setExplanation,
  stemRef,
  optionRefs,
  explanationRef,
  sessionTagIds = [],
  onSaveSuccess,
}: BulkMCQFormProps) {
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
      // V6: Include session tags - Requirements R2.2
      sessionTagIds.forEach((tagId, i) => formData.append(`tagId_${i}`, tagId))

      const { createMCQAction } = await import('@/actions/mcq-actions')
      const result = await createMCQAction({ success: true }, formData)

      if (result.success) {
        setMessage({ type: 'success', text: 'MCQ created successfully!' })
        // Reset form - use parent setters (5 options for AI compatibility)
        setStem('')
        setOptions(['', '', '', '', ''])
        setCorrectIndex(0)
        setExplanation('')
        // V6: Focus back to PDF viewer - Requirements R3.2
        onSaveSuccess?.()
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
        
        {/* Add option button - max 5 options (A-E) */}
        {options.length < 5 && (
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
          Min 2, max 5 options (A-E)
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
