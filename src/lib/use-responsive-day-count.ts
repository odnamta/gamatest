'use client'

import { useState, useEffect } from 'react'

/**
 * Large breakpoint in pixels (matches Tailwind's 'lg' breakpoint)
 */
export const LARGE_BREAKPOINT = 1024

/**
 * Day counts for different viewport sizes
 */
export const SMALL_SCREEN_DAYS = 28
export const LARGE_SCREEN_DAYS = 60

/**
 * Pure function to determine day count based on viewport width.
 * Exported for property testing.
 * 
 * @param viewportWidth - Current viewport width in pixels
 * @returns 28 for small screens, 60 for large screens
 * 
 * Requirements: 1.1, 1.2
 */
export function getDayCountForViewport(viewportWidth: number): number {
  return viewportWidth >= LARGE_BREAKPOINT ? LARGE_SCREEN_DAYS : SMALL_SCREEN_DAYS
}

/**
 * Hook that returns the appropriate day count based on viewport size.
 * Returns 28 days for small screens (< 1024px), 60 days for large screens.
 * 
 * Requirements: 1.1, 1.2
 */
export function useResponsiveDayCount(): number {
  // Default to small screen for SSR
  const [dayCount, setDayCount] = useState(SMALL_SCREEN_DAYS)

  useEffect(() => {
    // Check initial viewport size
    const updateDayCount = () => {
      setDayCount(getDayCountForViewport(window.innerWidth))
    }

    // Set initial value
    updateDayCount()

    // Create media query listener
    const mediaQuery = window.matchMedia(`(min-width: ${LARGE_BREAKPOINT}px)`)
    
    // Handler for media query changes
    const handleChange = () => {
      updateDayCount()
    }

    // Add listener (using addEventListener for modern browsers)
    mediaQuery.addEventListener('change', handleChange)

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return dayCount
}
