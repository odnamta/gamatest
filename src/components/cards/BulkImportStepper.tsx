'use client'

import { FileText, MousePointer, PlusCircle, Check } from 'lucide-react'

interface BulkImportStepperProps {
  currentStep: 1 | 2 | 3
  linkedSourceName?: string | null
}

/**
 * BulkImportStepper Component
 * Visual breadcrumb for bulk import workflow.
 * Requirements: 4.1, 4.2, 4.3
 * 
 * Feature: v3-ux-overhaul
 */
export function BulkImportStepper({
  currentStep,
  linkedSourceName,
}: BulkImportStepperProps) {
  const steps = [
    { number: 1, label: 'Upload PDF', icon: FileText },
    { number: 2, label: 'Select Text', icon: MousePointer },
    { number: 3, label: 'Create MCQ', icon: PlusCircle },
  ]

  return (
    <div className="mb-6">
      {/* Stepper - Requirement 4.1 */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = step.number === currentStep
          const isCompleted = step.number < currentStep

          return (
            <div key={step.number} className="flex items-center">
              {/* Step indicator */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : isCompleted
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="text-sm font-medium hidden sm:inline">
                  {step.number}. {step.label}
                </span>
                <span className="text-sm font-medium sm:hidden">
                  {step.number}
                </span>
              </div>

              {/* Arrow between steps */}
              {index < steps.length - 1 && (
                <span className="mx-2 text-slate-400 dark:text-slate-500">→</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Linked source banner - Requirements 4.2, 4.3 */}
      {linkedSourceName && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <span className="text-lg">📖</span>
          <span className="text-green-700 dark:text-green-400 font-medium">
            Linked Source: {linkedSourceName}
          </span>
        </div>
      )}
    </div>
  )
}
