'use client'

import { useState, useCallback } from 'react'
import { generateImportSessionId } from '@/lib/import-session'
import { getSessionStats } from '@/actions/session-actions'

const STORAGE_KEY_PREFIX = 'cekatan:import-session:'

interface ImportSessionState {
  sessionId: string | null
  draftCount: number
  publishedCount: number
  questionNumbers: number[]
  isLoading: boolean
}

/**
 * V11.3: Hook for managing import session state
 * Generates and persists session ID per deck, tracks session stats.
 */
export function useImportSession(deckId: string) {
  const [state, setState] = useState<ImportSessionState>(() => {
    // Initialize session ID from localStorage synchronously
    if (typeof window !== 'undefined') {
      const storageKey = `${STORAGE_KEY_PREFIX}${deckId}`
      let sid = localStorage.getItem(storageKey)
      if (!sid) {
        sid = generateImportSessionId()
        localStorage.setItem(storageKey, sid)
      }
      return {
        sessionId: sid,
        draftCount: 0,
        publishedCount: 0,
        questionNumbers: [],
        isLoading: false,
      }
    }
    return {
      sessionId: null,
      draftCount: 0,
      publishedCount: 0,
      questionNumbers: [],
      isLoading: true,
    }
  })

  // Handle deckId changes after initial mount
  const [prevDeckId, setPrevDeckId] = useState(deckId)
  if (prevDeckId !== deckId) {
    setPrevDeckId(deckId)
    const storageKey = `${STORAGE_KEY_PREFIX}${deckId}`
    let sid = localStorage.getItem(storageKey)
    if (!sid) {
      sid = generateImportSessionId()
      localStorage.setItem(storageKey, sid)
    }
    setState({
      sessionId: sid,
      draftCount: 0,
      publishedCount: 0,
      questionNumbers: [],
      isLoading: false,
    })
  }

  // Refresh session stats
  const refreshStats = useCallback(async () => {
    if (!state.sessionId) return
    
    const result = await getSessionStats(state.sessionId)
    if (result.ok && result.stats) {
      setState(prev => ({
        ...prev,
        draftCount: result.stats!.draftCount,
        publishedCount: result.stats!.publishedCount,
        questionNumbers: result.stats!.questionNumbers,
      }))
    }
  }, [state.sessionId])

  // Start a new session
  const startNewSession = useCallback(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${deckId}`
    const newSessionId = generateImportSessionId()
    localStorage.setItem(storageKey, newSessionId)
    
    setState({
      sessionId: newSessionId,
      draftCount: 0,
      publishedCount: 0,
      questionNumbers: [],
      isLoading: false,
    })
  }, [deckId])

  // Increment draft count locally (optimistic update)
  const incrementDraftCount = useCallback((count: number) => {
    setState(prev => ({
      ...prev,
      draftCount: prev.draftCount + count,
    }))
  }, [])

  // Add question numbers locally (optimistic update)
  const addQuestionNumbers = useCallback((numbers: number[]) => {
    setState(prev => ({
      ...prev,
      questionNumbers: [...new Set([...prev.questionNumbers, ...numbers])].sort((a, b) => a - b),
    }))
  }, [])

  return {
    sessionId: state.sessionId,
    draftCount: state.draftCount,
    publishedCount: state.publishedCount,
    questionNumbers: state.questionNumbers,
    isLoading: state.isLoading,
    refreshStats,
    startNewSession,
    incrementDraftCount,
    addQuestionNumbers,
  }
}
