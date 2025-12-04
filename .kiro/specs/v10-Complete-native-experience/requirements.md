# Requirements Document

## Introduction

V10.0 transforms Specialize into a complete native-like experience through three pillars: PWA infrastructure for home screen installation, UI polish to clinical standards, and Google authentication for frictionless onboarding. This release focuses on making the app feel professional and accessible on mobile devices while simplifying the login experience.

## Glossary

- **PWA (Progressive Web App)**: A web application that uses modern web capabilities to deliver app-like experiences, including home screen installation.
- **Service Worker**: A script that runs in the background, enabling offline caching.
- **Manifest**: A JSON file (`manifest.json`) that defines how the PWA appears when installed (name, icons, display mode).
- **Standalone Mode**: A display mode where the PWA runs without browser UI (address bar, tabs).
- **InstallBanner**: A UI component prompting users to add the app to their home screen.
- **MobileNavBar**: A fixed bottom navigation bar for mobile devices replacing the sidebar.
- **OAuth**: Open Authorization protocol allowing users to sign in via third-party providers like Google.
- **Empty State**: UI displayed when a list or collection has no items.

## Requirements

### Requirement 1

**User Story:** As a mobile user, I want to install Specialize on my home screen, so that I can launch it like a native app without opening a browser.

#### Acceptance Criteria

1. WHEN the PWA is installed THEN the System SHALL display "Specialize" as the app name on the home screen
2. WHEN the PWA is launched from the home screen THEN the System SHALL open in standalone mode without browser UI
3. WHEN the PWA is installed THEN the System SHALL display the app icon (192px or 512px based on device)
4. WHEN the service worker is registered THEN the System SHALL cache static assets for faster loads
5. WHEN deploying to Vercel THEN the System SHALL exclude middleware-manifest.json from the build to prevent crashes

### Requirement 2

**User Story:** As a mobile web user who hasn't installed the app, I want to see installation instructions, so that I can easily add Specialize to my home screen.

#### Acceptance Criteria

1. WHEN a user visits on mobile web in browser mode THEN the System SHALL display the InstallBanner component
2. WHEN a user is already in standalone PWA mode THEN the System SHALL hide the InstallBanner
3. WHEN a user dismisses the InstallBanner THEN the System SHALL persist the dismissal and hide the banner
4. WHEN a user is on iOS THEN the System SHALL display iOS-specific instructions mentioning the Share icon
5. WHEN a user is on Android THEN the System SHALL display Android-specific instructions or trigger native prompt

### Requirement 3

**User Story:** As a user, I want consistent and polished UI components, so that the app feels professional and trustworthy for medical study.

#### Acceptance Criteria

1. WHEN a Button component is rendered with variant "primary" THEN the System SHALL display blue styling
2. WHEN a Button component is rendered with variant "secondary" THEN the System SHALL display slate styling
3. WHEN a Button component is in loading state THEN the System SHALL display a spinner and disable interaction
4. WHEN a Card component is rendered THEN the System SHALL apply rounded-xl corners, slate-200 border, and shadow-sm
5. WHEN a list has no items THEN the System SHALL display a friendly empty state with icon and message

### Requirement 4

**User Story:** As a mobile user, I want bottom navigation, so that I can easily access main sections with my thumb.

#### Acceptance Criteria

1. WHEN the app is viewed on mobile viewport THEN the System SHALL display the MobileNavBar at the bottom
2. WHEN the app is viewed on mobile viewport THEN the System SHALL hide the desktop sidebar
3. WHEN the MobileNavBar is displayed THEN the System SHALL show Home, Library, and Profile navigation items
4. WHEN a navigation item is active THEN the System SHALL visually highlight the active item
5. WHEN the user taps a navigation item THEN the System SHALL navigate to the corresponding route

### Requirement 5

**User Story:** As a new user, I want to sign in with Google, so that I can start studying without creating a new account.

#### Acceptance Criteria

1. WHEN the login page is displayed THEN the System SHALL show a "Continue with Google" button
2. WHEN a user clicks "Continue with Google" THEN the System SHALL initiate OAuth flow via Supabase
3. WHEN Google authentication succeeds THEN the System SHALL redirect the user to the dashboard
4. WHEN Google authentication fails THEN the System SHALL display an error message
5. WHEN the login page is displayed THEN the System SHALL show the app logo centered above the form

## Non-Functional Requirements

- **Performance**: Service worker caching reduces repeat load times
- **Security**: OAuth handled by Supabase; no credentials stored client-side
- **Accessibility**: Touch targets meet WCAG 2.1 minimum of 44x44px; buttons have proper focus states
- **Mobile-First**: All components designed for 375px viewport first

## Out of Scope

- Full offline mode with data sync
- Push notifications
- Apple Sign-In
- Email/password registration (existing flow remains)

## Dependencies

- `next-pwa` package for service worker generation
- Supabase Google OAuth provider (configured in Supabase Dashboard by user)
