# CLAUDE.md — Cekatan Platform

## Project Overview

**Cekatan** is a domain-agnostic organizational assessment, study, and skills mapping platform.

**Deployment:** Vercel project `prj_VzSkaTL6PpWj2qfxag7QNUoJ6L7B` — **PAUSED** (freed Supabase slot for GLS-ERP). Supabase `hltuqxtemjpwfwjolyey` also paused.
**Pending deploy:** `ed20747` — fixed all 43 react-hooks/* lint errors (19 files, React Compiler compliance). Resume Vercel + Supabase to deploy.

**Architecture:** ONE platform, TWO modes (Study Mode + Assessment Mode).
**Multi-tenant:** Each organization is a tenant with its own content, users, and configuration.
**Domain-agnostic:** ZERO sector-specific code. The domain lives in content and org configuration, not in code.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript 5 (strict mode)
- **Database:** Supabase (PostgreSQL + Auth + RLS + Storage + Realtime)
- **Auth:** Supabase Auth (Google OAuth + email/password planned)
- **Styling:** Tailwind CSS 4 + shadcn/ui (for complex components) + custom primitives
- **Validation:** Zod
- **Testing:** Vitest + fast-check (property-based testing)
- **Charts:** Recharts
- **PDF:** @react-pdf/renderer (generation) + react-pdf (viewing)
- **Email:** Resend + @react-email/components
- **AI:** OpenAI SDK (GPT-4 Vision for MCQ generation)
- **Icons:** lucide-react
- **PWA:** next-pwa

## Architecture

### Multi-Tenant Model

Every content table has an `org_id` column. All queries are org-scoped.

```
organizations (tenant root)
├── organization_members (user_id, role: owner/admin/creator/candidate)
├── deck_templates (org_id, content)
│   └── card_templates (inherits org scope from deck)
├── tags (org_id)
├── book_sources (org_id)
└── assessments (org_id)
```

### Feature Flags

Features are controlled per-org via `organizations.settings` JSONB:

```typescript
interface OrgFeatures {
  study_mode: boolean        // SM-2 spaced repetition
  assessment_mode: boolean   // Timed, proctored tests
  proctoring: boolean        // Anti-cheat measures
  certification: boolean     // Certificate generation
  ai_generation: boolean     // AI MCQ generation
  pdf_extraction: boolean    // PDF-based card creation
  flashcards: boolean        // Flashcard study type
  erp_integration: boolean   // External API access
}
```

### Data Layer

Two-layer data model:
1. **Content Layer** (Org-scoped): `deck_templates`, `card_templates` — the actual questions/content
2. **Progress Layer** (User-scoped): `user_decks`, `user_card_progress` — per-user study state

### Roles

| Role | Permissions |
|------|------------|
| owner | Full org management, billing, delete org |
| admin | Manage members, content, assessments, settings |
| creator | Create/edit content, view analytics |
| candidate | Take tests, study, view own results |

## Code Conventions

### Server Actions

Use `withOrgUser` helper for org-scoped authenticated actions:

```typescript
import { withOrgUser } from '@/actions/_helpers'
import type { ActionResultV2 } from '@/types/actions'

export async function myAction(): Promise<ActionResultV2<MyData>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    // All queries should filter by org.id
    const { data } = await supabase
      .from('deck_templates')
      .select('*')
      .eq('org_id', org.id)
    return { ok: true, data: result }
  })
}
```

Use `withUser` (without org context) only for user-level actions (profile, org selection).

### Return Types

- **All actions:** Use `ActionResultV2<T>` with `{ ok: true/false }` pattern
- Legacy `ActionResult` with `{ success: true/false }` is fully migrated — all actions use `ActionResultV2`

### Validation

All form inputs validated with Zod schemas in `src/lib/validations.ts`.

### Authorization

Pure function authorization modules in `src/lib/*-authorization.ts`. These are independently testable.

### Testing

Property-based tests with fast-check in `src/__tests__/*.property.test.ts`. E2E tests with Playwright in `e2e/`.

```bash
npm run test              # Run all unit tests (Vitest)
npm run test:watch        # Watch mode
npm run test:e2e          # Run E2E tests (Playwright)
npx vitest run src/__tests__/sm2.property.test.ts  # Single file
```

### Email Notifications

Templates in `src/components/email/` using @react-email. Dispatch helpers in `src/lib/email-dispatch.tsx`.
HMAC-signed unsubscribe tokens. Resend for delivery with 3-attempt exponential backoff.

### PDF Generation

PDF components in `src/lib/*-pdf.tsx` using @react-pdf/renderer. Server actions render via `renderToBuffer()`,
upload to Supabase Storage `certificates` bucket, return signed URLs (7-day expiry).

## Styling

- **Framework:** Tailwind CSS 4 with `@tailwindcss/typography`
- **Complex UI:** Use shadcn/ui components (dialogs, data tables, command menus)
- **Simple UI:** Custom primitives in `src/components/ui/` (Button, Card, Input, Toast)
- **Mobile-first:** Default to `flex-col` layouts, design for 375px width first
- **Buttons:** Include `active:scale-95` micro-interaction
- **Dark mode:** Supported via `next-themes`

## Key Directories

```
src/
├── actions/          # Server Actions ('use server'), split by domain
├── app/              # Next.js App Router pages
│   ├── (app)/        # Authenticated routes
│   ├── (auth)/       # Auth routes
│   └── api/          # REST API routes
├── components/       # React components (by feature domain)
│   ├── email/        # React Email templates (Resend)
│   └── ui/           # Reusable UI primitives
├── hooks/            # Custom React hooks
├── lib/              # Pure functions & utilities
│   └── supabase/     # Supabase client setup
├── types/            # TypeScript type definitions
├── __tests__/        # Property-based tests (Vitest + fast-check)
e2e/                  # E2E tests (Playwright)
```

## Common Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Build for production
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run seed         # Seed database with sample data
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
RESEND_API_KEY=your-resend-api-key
NEXT_PUBLIC_APP_URL=https://cekatan.com
```

## Rules

- NEVER write sector-specific code (no /logistics/, no /medical/)
- ALL content tables must have org_id (or inherit org scope via parent FK)
- ALL content queries must be org-scoped
- Feature availability determined by org.settings.features
- Keep existing tests passing throughout refactor
- Run `npm test` before committing
- Use `ActionResultV2<T>` for all new actions
- Path alias: `@/*` maps to `./src/*`

## PWA Configuration

The `next.config.ts` **MUST** include this to prevent Vercel build crashes:
```typescript
buildExcludes: [/middleware-manifest\.json$/]
```
