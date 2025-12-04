# Implementation Plan

## Phase 1: PWA Infrastructure

- [x] 1. Set up PWA dependencies and configuration
  - [x] 1.1 Install `next-pwa` package
    - Run `npm install next-pwa`
    - _Requirements: 1.4_
  - [x] 1.2 Update `next.config.ts` with PWA configuration
    - Wrap existing config with `withPWA`
    - Set `disable: process.env.NODE_ENV === 'development'`
    - Set `dest: 'public'`, `register: true`, `skipWaiting: true`
    - CRITICAL: Add `buildExcludes: [/middleware-manifest\.json$/]` to prevent Vercel crash
    - _Requirements: 1.4, 1.5_
  - [x] 1.3 Create `public/manifest.json`
    - Set `name: "Specialize"`, `short_name: "Specialize"`
    - Set `display: "standalone"`, `start_url: "/"`
    - Set `theme_color: "#ffffff"`, `background_color: "#ffffff"`
    - _Requirements: 1.1, 1.2_
  - [x] 1.4 Create placeholder app icons
    - Create `public/icon-192x192.png` (192x192 placeholder "S" logo)
    - Create `public/icon-512x512.png` (512x512 placeholder "S" logo)
    - Create `public/apple-touch-icon.png` (180x180 for iOS)
    - _Requirements: 1.3_
  - [x] 1.5 Add PWA meta tags to root layout
    - Add `<link rel="manifest" href="/manifest.json">`
    - Add `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
    - Add `<meta name="apple-mobile-web-app-capable" content="yes">`
    - Add `<meta name="theme-color" content="#ffffff">`
    - _Requirements: 1.2, 1.3_

## Phase 2: Install Banner

- [x] 2. Implement InstallBanner component
  - [x] 2.1 Create `src/components/pwa/InstallBanner.tsx`
    - Create component with fixed bottom bar UI
    - Style with Tailwind: white background, border-top, shadow
    - Add dismiss button (X icon)
    - _Requirements: 2.1_
  - [x] 2.2 Implement standalone mode and dismissal detection
    - Use `window.matchMedia('(display-mode: standalone)')` to detect PWA mode
    - Check localStorage key `specialize-install-banner-dismissed`
    - Visibility logic: `!isStandalone && !isDismissed`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.3 Implement dismissal persistence
    - On dismiss click, set localStorage key to "true"
    - Hide banner immediately after dismissal
    - _Requirements: 2.3_
  - [x] 2.4 Implement platform-specific instructions
    - Detect iOS via user agent (`/iPad|iPhone|iPod/`)
    - iOS: "Tap the Share icon, then 'Add to Home Screen'"
    - Android/Other: "Install this app from your browser menu"
    - _Requirements: 2.4, 2.5_
  - [x] 2.5 Write property tests for banner visibility and platform detection
    - **Property 1: Install Banner Visibility Logic**
    - **Property 2: Install Banner Dismissal Persistence**
    - **Property 3: iOS Platform Detection**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  - [x] 2.6 Integrate InstallBanner into root layout
    - Add InstallBanner to `src/app/layout.tsx` or app shell
    - Position at bottom of viewport
    - _Requirements: 2.1_

## Phase 3: UI Component Polish

- [x] 3. Upgrade Button component
  - [x] 3.1 Refactor `src/components/ui/Button.tsx`
    - Add `variant` prop: 'primary' | 'secondary' | 'ghost' | 'destructive'
    - Add `loading` prop with spinner support
    - Primary: `bg-blue-600 text-white hover:bg-blue-700`
    - Secondary: `bg-slate-100 text-slate-900 border border-slate-200`
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 3.2 Implement loading state with spinner
    - Import Loader2 from lucide-react
    - When loading=true: disable button, show spinner with `animate-spin`
    - Maintain button width during loading
    - _Requirements: 3.3_
  - [x] 3.3 Write property tests for Button variants and loading
    - **Property 4: Button Primary Variant Styling**
    - **Property 5: Button Secondary Variant Styling**
    - **Property 6: Button Loading State**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 4. Upgrade Card component
  - [x] 4.1 Refactor `src/components/ui/Card.tsx`
    - Enforce base styles: `rounded-xl border border-slate-200 shadow-sm bg-white`
    - Allow className override for additional styles
    - _Requirements: 3.4_
  - [x] 4.2 Write property test for Card styling
    - **Property 7: Card Base Styling**
    - **Validates: Requirements 3.4**

- [x] 5. Create EmptyState component
  - [x] 5.1 Create `src/components/ui/EmptyState.tsx`
    - Props: icon, title, description, action
    - Center content with flex layout
    - Muted colors for icon and description
    - _Requirements: 3.5_
  - [x] 5.2 Add empty states to deck list and library
    - Update deck list to show EmptyState when no decks
    - Update library to show EmptyState when no subscriptions
    - _Requirements: 3.5_

## Phase 4: Mobile Navigation

- [x] 6. Implement MobileNavBar
  - [x] 6.1 Create `src/components/navigation/MobileNavBar.tsx`
    - Fixed bottom bar: `fixed bottom-0 left-0 right-0`
    - Three items: Home (/dashboard), Library (/library), Profile (/profile)
    - Use lucide-react icons: Home, Library, User
    - _Requirements: 4.1, 4.3_
  - [x] 6.2 Implement active state highlighting
    - Use `usePathname()` to get current route
    - Active item: `text-blue-600`, inactive: `text-slate-500`
    - _Requirements: 4.4_
  - [x] 6.3 Implement navigation on tap
    - Use Next.js Link component for each item
    - Ensure proper navigation to each route
    - _Requirements: 4.5_
  - [x] 6.4 Write property tests for MobileNavBar
    - **Property 8: MobileNavBar Items**
    - **Property 9: MobileNavBar Active State**
    - **Property 10: MobileNavBar Navigation**
    - **Validates: Requirements 4.3, 4.4, 4.5**
  - [x] 6.5 Update layout for responsive navigation
    - Hide desktop sidebar on mobile: `hidden md:flex`
    - Show MobileNavBar on mobile: `md:hidden`
    - Add bottom padding to main content to account for nav bar
    - _Requirements: 4.1, 4.2_

## Phase 5: Google Authentication

- [x] 7. Implement Google OAuth
  - [x] 7.1 Update login page UI
    - Add app logo centered above form
    - Style form container with Card component
    - Center content on page
    - _Requirements: 5.5_
  - [x] 7.2 Add "Continue with Google" button
    - Add Google icon (or use text-only button)
    - Style as secondary variant with Google branding
    - _Requirements: 5.1_
  - [x] 7.3 Implement Google OAuth handler
    - Call `supabase.auth.signInWithOAuth({ provider: 'google' })`
    - Set `redirectTo` to `/auth/callback`
    - Handle and display errors
    - _Requirements: 5.2, 5.4_
  - [x] 7.4 Create or update auth callback route
    - Ensure `src/app/auth/callback/route.ts` exchanges code for session
    - Redirect to `/dashboard` on success
    - _Requirements: 5.3_

## Phase 6: Final Checkpoint

- [x] 8. Final verification
  - [x] 8.1 Checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.
  - [x] 8.2 Manual testing checklist
    - Test PWA install on iOS Safari
    - Test PWA install on Android Chrome
    - Test Google login flow
    - Test mobile navigation on 375px viewport
    - Verify empty states display correctly
