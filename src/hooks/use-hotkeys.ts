'use client'

import { useEffect, useCallback } from 'react'

/**
 * Hotkey configuration for useHotkeys hook.
 */
export interface HotkeyConfig {
  /** The key to listen for (e.g., 'Enter', 'Escape') */
  key: string
  /** Modifier keys required (ctrl, meta, shift, alt) */
  modifiers?: ('ctrl' | 'meta' | 'shift' | 'alt')[]
  /** Handler function to call when hotkey is triggered */
  handler: () => void
  /** Whether this hotkey is currently enabled */
  enabled?: boolean
}

/**
 * Check if the event target is an input element where we should skip hotkeys.
 * We allow Cmd/Ctrl+Enter in form inputs for submission.
 */
function shouldSkipHotkey(event: KeyboardEvent, config: HotkeyConfig): boolean {
  const target = event.target as HTMLElement
  const tagName = target.tagName.toLowerCase()
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
  
  // Check if element has data-no-hotkeys attribute
  if (target.closest('[data-no-hotkeys]')) {
    return true
  }
  
  // For inputs, only allow Cmd/Ctrl+Enter (form submission)
  if (isInput) {
    const isSubmitShortcut = 
      config.key === 'Enter' && 
      (config.modifiers?.includes('meta') || config.modifiers?.includes('ctrl')) &&
      !config.modifiers?.includes('shift')
    
    // Skip if not a submit shortcut
    if (!isSubmitShortcut) {
      return true
    }
  }
  
  return false
}

/**
 * Check if the event matches the hotkey configuration.
 */
function matchesHotkey(event: KeyboardEvent, config: HotkeyConfig): boolean {
  // Check key
  if (event.key !== config.key) {
    return false
  }
  
  // Check modifiers
  const modifiers = config.modifiers || []
  
  const needsCtrl = modifiers.includes('ctrl')
  const needsMeta = modifiers.includes('meta')
  const needsShift = modifiers.includes('shift')
  const needsAlt = modifiers.includes('alt')
  
  // For cross-platform support, treat meta and ctrl as interchangeable for shortcuts
  const hasCtrlOrMeta = event.ctrlKey || event.metaKey
  const needsCtrlOrMeta = needsCtrl || needsMeta
  
  if (needsCtrlOrMeta && !hasCtrlOrMeta) return false
  if (!needsCtrlOrMeta && hasCtrlOrMeta) return false
  
  if (needsShift !== event.shiftKey) return false
  if (needsAlt !== event.altKey) return false
  
  return true
}

/**
 * Hook for handling keyboard shortcuts.
 * 
 * Requirements: R3.1 - Hotkeys on Bulk Import Page, R3.2 - Safety & Focus
 * 
 * @param hotkeys - Array of hotkey configurations
 * 
 * @example
 * useHotkeys([
 *   {
 *     key: 'Enter',
 *     modifiers: ['meta'],
 *     handler: handleSubmit,
 *     enabled: !isBatchPanelOpen,
 *   },
 *   {
 *     key: 'Escape',
 *     handler: handleClose,
 *     enabled: true,
 *   },
 * ])
 */
export function useHotkeys(hotkeys: HotkeyConfig[]): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const config of hotkeys) {
        // Skip disabled hotkeys
        if (config.enabled === false) {
          continue
        }
        
        // Check if we should skip this hotkey for the current target
        if (shouldSkipHotkey(event, config)) {
          continue
        }
        
        // Check if event matches this hotkey
        if (matchesHotkey(event, config)) {
          event.preventDefault()
          config.handler()
          return // Only trigger one hotkey per event
        }
      }
    },
    [hotkeys]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Detect if the current platform is Mac.
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

/**
 * Get the appropriate modifier key for the current platform.
 * Returns 'meta' for Mac, 'ctrl' for others.
 */
export function getPlatformModifier(): 'meta' | 'ctrl' {
  return isMac() ? 'meta' : 'ctrl'
}
