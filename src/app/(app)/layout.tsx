import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { resolveActiveOrg } from '@/lib/org-context'
import { logoutAction } from '@/actions/auth-actions'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ToastProvider } from '@/components/ui/Toast'
import { MobileNavBar } from '@/components/navigation/MobileNavBar'
import { OnboardingWrapper } from '@/components/onboarding/OnboardingWrapper'
import { OrgProvider } from '@/components/providers/OrgProvider'
import { OrgSwitcher } from '@/components/navigation/OrgSwitcher'
import { NotificationBell } from '@/components/navigation/NotificationBell'
import { CommandPalette } from '@/components/navigation/CommandPalette'
import { DesktopNavLinks } from '@/components/navigation/DesktopNavLinks'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { AuthGuard } from '@/components/providers/AuthGuard'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // V13: Resolve active org context
  const orgContext = await resolveActiveOrg()

  if (!orgContext) {
    redirect('/orgs/create')
  }

  return (
    <ToastProvider>
      <AuthGuard>
      <OrgProvider org={orgContext.org} role={orgContext.role}>
        {/* Onboarding Modal - Requirements 3.1 */}
        <OnboardingWrapper
          userMetadata={user.user_metadata as { onboarded?: boolean } | null}
          userName={user.user_metadata?.full_name || user.email?.split('@')[0]}
        />
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
          {/* Skip to content link for keyboard/screen-reader users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
          >
            Skip to content
          </a>
          {/* Header with glassmorphism */}
          <header className="sticky top-0 z-40 border-b border-white/20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg pt-safe" role="banner">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <a href="/dashboard" className="text-xl font-semibold text-slate-900 dark:text-slate-100" aria-label="Cekatan — Go to dashboard">
                  Cekatan
                </a>
                <DesktopNavLinks />
              </div>
              <div className="flex items-center gap-2">
                <CommandPalette />
                <NotificationBell />
                {/* V13: Org switcher */}
                <OrgSwitcher />
                <ThemeToggle />
                <form action={logoutAction}>
                  <Button type="submit" variant="ghost" size="sm">
                    Logout
                  </Button>
                </form>
              </div>
            </div>
          </header>
          <main id="main-content" className="flex-1 pb-16 md:pb-0" tabIndex={-1}>
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </main>
          <MobileNavBar />
          <OfflineIndicator />
        </div>
      </OrgProvider>
      </AuthGuard>
    </ToastProvider>
  )
}
