# 🛡️ Agent Steering Rules: "Specialize" (V10)

## 1. Product Identity & Design

- **Name:** "Specialize" (Medical Board Prep).
- **Target Audience:** Busy Medical Residents (Mobile-first, tired eyes).
- **Aesthetic:** "Clinical Glass." Use `bg-slate-50`, `backdrop-blur-md`, and `bg-white/80`.
- **UI System:** Do NOT use external UI libraries (Shadcn CLI). Use the custom components in `src/components/ui`.
- **Buttons:** Must have `active:scale-95` micro-interaction.
- **Layout:** Fixed bottom navigation on mobile (`MobileNavBar`).

## 2. Authentication (Strict)

- **Provider:** **Google OAuth ONLY.**
- **Prohibited:** Do NOT build Email/Password forms, Sign Up toggles, or Forgot Password flows.
- **Onboarding:** New users must go through the "Welcome Wizard" (Specialty Selection) before accessing the Dashboard.

## 3. Data Architecture (The V2 Law)

- **Legacy Tables:** NEVER read/write to `public.cards` or `public.decks`. They are dead.
- **Shared Content:** Content lives in `deck_templates` and `card_templates` (Shared).
- **User Progress:** Study data lives in `user_decks` and `user_card_progress` (Private).
- **Permissions:**
  - **Students:** READ templates, WRITE progress.
  - **Authors:** WRITE templates, WRITE progress.

## 4. Medical Data Integrity

- **Units:** NEVER convert units (e.g., maintain `2500g`, do not change to `5.5lbs`).
- **AI Generation:** When drafting questions, extracting text must be **verbatim**. Do not invent missing values.
- **Tags:** Use the 3-Tier Taxonomy (Source / Topic / Concept).

## 5. Technical Constraints

- **PWA:** Ensure `buildExcludes: [/middleware-manifest\.json$/]` stays in `next.config.mjs` to prevent Vercel build crashes.
- **Server Actions:** Must be `async`. Do not put synchronous helpers in `src/actions`.
- **Database:** Use `supabase` MCP for schema inspection before writing queries.
