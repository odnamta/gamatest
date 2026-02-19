'use client'

import { useEffect } from 'react'

/**
 * Sets the document title for client components.
 * Follows the same pattern as the root layout title template: "Page - Cekatan"
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} - Cekatan` : 'Cekatan'
  }, [title])
}
