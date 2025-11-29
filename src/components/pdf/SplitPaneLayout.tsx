'use client'

import { ReactNode } from 'react'

interface SplitPaneLayoutProps {
  leftPane: ReactNode
  rightPane: ReactNode
}

/**
 * SplitPaneLayout - Responsive split-pane layout for PDF viewer + form
 * Desktop: 50/50 horizontal split
 * Mobile: Vertical stack (PDF top, form bottom)
 * Requirements: V5 Feature Set 2 - Req 2.5, 2.6
 */
export function SplitPaneLayout({ leftPane, rightPane }: SplitPaneLayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
      {/* Left pane - PDF Viewer */}
      <div className="w-full lg:w-1/2 min-h-[300px] lg:min-h-0 lg:h-[calc(100vh-200px)] flex-shrink-0">
        {leftPane}
      </div>
      
      {/* Right pane - Form */}
      <div className="w-full lg:w-1/2 flex-1 overflow-y-auto">
        {rightPane}
      </div>
    </div>
  )
}
