'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { LegalFooter } from '@/components/auth/LegalFooter'
import { Button } from '@/components/ui/Button'
import { Mail, Eye, EyeOff } from 'lucide-react'

/**
 * Extracts OAuth error from URL (query string or hash fragment)
 */
function extractOAuthError(): { error: string; description: string } | null {
  if (typeof window === 'undefined') return null

  const searchParams = new URLSearchParams(window.location.search)
  let error = searchParams.get('error')
  let description = searchParams.get('error_description')

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

function clearErrorFromUrl(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  url.searchParams.delete('error_code')

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

function AppLogo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
        <span className="text-4xl font-bold text-white">C</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        Selamat Datang di Cekatan
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
        Platform asesmen & pemetaan kompetensi
      </p>
    </div>
  )
}

function GoogleSignInButton({
  onClick,
  isLoading,
}: {
  onClick: () => void
  isLoading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl px-6 py-3.5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )}
      <span className="font-medium text-sm">Lanjutkan dengan Google</span>
    </button>
  )
}

/**
 * LoginPage — Google OAuth + Email/Password authentication
 * V20: Added email/password sign-in and sign-up tabs
 */
export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [emailLoading, setEmailLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Check for OAuth errors — initialize error state from URL if present
  const [oauthChecked, setOauthChecked] = useState(false)
  if (!oauthChecked && typeof window !== 'undefined') {
    setOauthChecked(true)
    const oauthError = extractOAuthError()
    if (oauthError) {
      clearErrorFromUrl()
      setError(oauthError.description)
    }
  }

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
    } catch {
      setError('Gagal terhubung ke Google. Silakan coba lagi.')
      setIsGoogleLoading(false)
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setEmailLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()

      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Password tidak cocok')
          setEmailLoading(false)
          return
        }
        if (password.length < 6) {
          setError('Password harus minimal 6 karakter')
          setEmailLoading(false)
          return
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) {
          setError(error.message)
        } else {
          setSuccess('Periksa email Anda untuk link konfirmasi untuk menyelesaikan pendaftaran.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(error.message)
        } else {
          router.push('/dashboard')
          return
        }
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    }
    setEmailLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <Card variant="elevated" padding="lg" className="w-full max-w-md shadow-lg">
        <AppLogo />

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm text-center">
            {success}
          </div>
        )}

        {/* Google OAuth */}
        <GoogleSignInButton onClick={handleGoogleSignIn} isLoading={isGoogleLoading} />

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">atau lanjutkan dengan email</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700/50 p-1 mb-4">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); setSuccess(null) }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Daftar
          </button>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 6 characters' : 'Enter password'}
                required
                minLength={6}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <Button
            type="submit"
            loading={emailLoading}
            disabled={emailLoading || !email || !password}
            className="w-full"
          >
            {mode === 'login' ? 'Masuk' : 'Buat Akun'}
          </Button>
        </form>

        <LegalFooter />
      </Card>
    </div>
  )
}
