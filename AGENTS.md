# AGENTS.md

This file provides guidance to AI coding assistants working with this repository.

## Project Overview

**Cekatan** is a multi-tenant assessment and study platform. ONE platform, TWO modes (Study Mode + Assessment Mode). Domain-agnostic — the domain lives in content and org configuration, not in code.

## Common Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Build for production (uses --webpack flag)
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run seed         # Seed database with sample data (npx tsx scripts/seed-data.ts)
```

## Architecture

### Multi-Tenant Model

Every content table has an `org_id` column. All queries must be org-scoped.

Roles: `owner` | `admin` | `creator` | `candidate`

### Data Layer

**DO NOT** read/write to `public.cards` or `public.decks` - these are legacy tables.

The app uses a two-layer data model:
1. **Content Layer** (Org-scoped): `deck_templates`, `card_templates` - stores the actual content
2. **Progress Layer** (User-scoped): `user_decks`, `user_card_progress` - stores per-user study state

### Key Directories

- `src/actions/` - Server Actions (mutations). All must be `async` and use `'use server'` directive
- `src/lib/` - Pure utility functions (SM-2 algorithm in `sm2.ts`, streak logic in `streak.ts`)
- `src/lib/supabase/` - Supabase clients (`server.ts` for Server Components/Actions, `client.ts` for Client Components)
- `src/components/ui/` - Custom UI primitives + shadcn/ui components
- `src/types/` - TypeScript types (`database.ts` for entities, `actions.ts` for action results)
- `src/__tests__/` - Property-based tests using fast-check (`*.property.test.ts`)

### Server Action Patterns

Use the `withOrgUser` helper for org-scoped authenticated actions:

```typescript
import { withOrgUser } from '@/actions/_helpers'
import type { ActionResultV2 } from '@/types/actions'

export async function myAction(): Promise<ActionResultV2<MyData>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    // All queries should filter by org.id
    return { ok: true, data: result }
  })
}
```

Use `withUser` (without org context) only for user-level actions (profile, org selection).

Return types:
- **All actions**: Use `ActionResultV2<T>` with `{ ok: true/false }` pattern
- Legacy `ActionResult` with `{ success: true/false }` is deprecated

### Validation

All form inputs validated with Zod schemas in `src/lib/validations.ts`. Create schemas there and infer TypeScript types.

## Styling Rules

- **Framework**: Tailwind CSS 4 with `@tailwindcss/typography`
- **Complex UI**: Use shadcn/ui components
- **Simple UI**: Custom primitives in `src/components/ui/`
- **Mobile-first**: Default to `flex-col` layouts, design for 375px width first
- **Buttons**: Must include `active:scale-95` micro-interaction
- **Dark mode**: Supported via `next-themes`

## Authentication

- **Google OAuth** via Supabase Auth
- New users go through Welcome Wizard before accessing Dashboard
- Protected routes handled in `src/middleware.ts`

## Content Rules

- **NEVER write sector-specific code** (no /logistics/, no /medical/ in codebase)
- **AI text extraction must be verbatim** — do not invent missing values
- **Tags use 3-tier taxonomy**: Source → Topic → Concept

## Testing

Property-based tests with fast-check. Tests are in `src/__tests__/*.property.test.ts`.

Run a single test file:
```bash
npx vitest run src/__tests__/sm2.property.test.ts
```

## PWA Configuration

The `next.config.ts` **MUST** include this to prevent Vercel build crashes:
```typescript
buildExcludes: [/middleware-manifest\.json$/]
```

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json)

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
```
