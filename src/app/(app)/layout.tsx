import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { logoutAction } from '@/actions/auth-actions'
import { getUserSubject } from '@/actions/analytics-actions'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ToastProvider } from '@/components/ui/Toast'
import { MobileNavBar } from '@/components/navigation/MobileNavBar'
import { OnboardingWrapper } from '@/components/onboarding/OnboardingWrapper'
import { SubjectBadge } from '@/components/navigation/SubjectBadge'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch user's subject for the badge - Requirements 2.1, 2.2
  const subjectResult = await getUserSubject()
  const subject = subjectResult.subject

  return (
    <ToastProvider>
      {/* Onboarding Modal - Requirements 3.1 */}
      <OnboardingWrapper 
        userMetadata={user.user_metadata as { onboarded?: boolean } | null}
        userName={user.user_metadata?.full_name || user.email?.split('@')[0]}
      />
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
        {/* Header with glassmorphism - Requirements 4.2, 4.3, 4.4 */}
        <header className="sticky top-0 z-40 border-b border-white/20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <a href="/dashboard" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Specialize
              </a>
              <nav className="hidden sm:flex items-center gap-4">
                <a 
                  href="/library" 
                  className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  Library
                </a>
                <a 
                  href="/library/my" 
                  className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  My Library
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {/* Subject Badge - Requirements 2.1, 2.4 */}
              <SubjectBadge subject={subject} />
              <ThemeToggle />
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="flex-1 pb-16 md:pb-0">
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </main>
        <MobileNavBar />
      </div>
    </ToastProvider>
  )
}
