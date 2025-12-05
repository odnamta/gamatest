'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { LegalFooter } from '@/components/auth/LegalFooter'

/**
 * Extracts OAuth error from URL (query string or hash fragment)
 * Supabase may put errors in either location depending on the flow
 */
function extractOAuthError(): { error: string; description: string } | null {
  if (typeof window === 'undefined') return null
  
  // Check query string first
  const searchParams = new URLSearchParams(window.location.search)
  let error = searchParams.get('error')
  let description = searchParams.get('error_description')
  
  // If not in query string, check hash fragment
  if (!error && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    error = hashParams.get('error')
    description = hashParams.get('error_description')
  }
  
  if (error) {
    return {
      error,
      description: description ? decodeURIComponent(description.replace(/\+/g, ' ')) : error,
    }
  }
  
  return null
}

/**
 * Clears error params from URL without triggering navigation
 */
function clearErrorFromUrl(): void {
  if (typeof window === 'undefined') return
  
  const url = new URL(window.location.href)
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  url.searchParams.delete('error_code')
  
  // Clear hash if it contains error params
  if (url.hash) {
    const hashParams = new URLSearchParams(url.hash.substring(1))
    if (hashParams.has('error')) {
      hashParams.delete('error')
      hashParams.delete('error_description')
      hashParams.delete('error_code')
      url.hash = hashParams.toString() ? `#${hashParams.toString()}` : ''
    }
  }
  
  window.history.replaceState({}, '', url.toString())
}

/**
 * App Logo component
 */
function AppLogo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
        <span className="text-4xl font-bold text-white">S</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        Welcome to Specialize
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
        Medical exam preparation
      </p>
    </div>
  )
}

/**
 * Google Sign In Button
 * Requirements: 1.3, 1.6
 */
function GoogleSignInButton({ 
  onClick, 
  isLoading 
}: { 
  onClick: () => void
  isLoading: boolean 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 border border-slate-200 rounded-xl px-6 py-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      <span className="font-medium text-base">Continue with Google</span>
    </button>
  )
}

/**
 * LoginPage - Pinterest-style Google-only authentication
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 * V10.5: Added OAuth error handling from URL params
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // Check for OAuth errors in URL on mount
  useEffect(() => {
    const oauthError = extractOAuthError()
    if (oauthError) {
      setError(oauthError.description)
      clearErrorFromUrl()
    }
  }, [])

  async function handleGoogleSignIn() {
    setError(null)
    setIsGoogleLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        setIsGoogleLoading(false)
      }
      // If successful, the page will redirect to Google
    } catch {
      setError('Failed to connect to Google. Please try again.')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <Card variant="elevated" padding="lg" className="w-full max-w-md shadow-lg">
        <AppLogo />

        {error && (
          <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Google Sign In Button - Requirements 1.3, 1.6 */}
        <GoogleSignInButton 
          onClick={handleGoogleSignIn} 
          isLoading={isGoogleLoading} 
        />

        {/* Legal Footer - Requirement 1.5 */}
        <LegalFooter />
      </Card>
    </div>
  )
}
