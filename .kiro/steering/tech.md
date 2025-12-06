# Tech Stack

## Framework & Runtime
- **Next.js 16** with App Router (React 19)
- **TypeScript** with strict mode
- **Node.js 20+**
- **PWA** via next-pwa (ensure `buildExcludes: [/middleware-manifest\.json$/]` in next.config.mjs)

## Database & Auth
- **Supabase** (PostgreSQL + Auth + Row Level Security)
- Server-side client via `@supabase/ssr`
- RLS policies enforce data access at database level
- **Google OAuth ONLY** - No email/password authentication

## Styling
- **Tailwind CSS 4** with `@tailwindcss/typography` plugin
- Dark mode support via `next-themes`
- Geist font family (Sans + Mono)
- **"Clinical Glass" Aesthetic**: `bg-slate-50`, `backdrop-blur-md`, `bg-white/80`
- **Mobile-first**: Default to `flex-col` layouts, test for 375px width

## UI Components
- **Custom components only** in `src/components/ui`
- Do NOT use Shadcn CLI or external UI libraries
- Buttons must have `active:scale-95` micro-interaction

## Key Libraries
- `zod` - Schema validation (forms, API inputs)
- `react-markdown` - Markdown rendering in cards
- `react-pdf` - PDF viewing for bulk import
- `lucide-react` - Icons
- `date-fns` - Date manipulation
- `openai` - AI-assisted card generation

## Testing
- **Vitest** - Test runner
- **fast-check** - Property-based testing
- **@testing-library/react** - Component testing
- Tests located in `src/__tests__/*.property.test.ts`

## Common Commands

```bash
# Development
npm run dev          # Start dev server (localhost:3000)

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode

# Code Quality
npm run lint         # Run ESLint

# Database
npm run seed         # Seed database with sample data
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json)

## MCP Integration

Use the `supabase` MCP server for schema inspection before writing database queries.
