# Project Structure

```text
src/
├── actions/          # Server Actions (mutations) - MUST be async
├── app/              # Next.js App Router
│   ├── (app)/        # Authenticated routes (dashboard, study, decks, etc.)
│   ├── (auth)/       # Auth routes (Google OAuth login only)
│   └── api/          # API routes
├── components/       # React components
│   ├── ai/           # AI-related (image upload, mode toggle)
│   ├── batch/        # Batch card creation
│   ├── cards/        # Card CRUD components
│   ├── dashboard/    # Dashboard widgets (heatmap, hero, stats)
│   ├── decks/        # Deck management & filtering
│   ├── library/      # Shared library browsing & subscription
│   ├── nav/          # Navigation (MobileNavBar - fixed bottom)
│   ├── pdf/          # PDF viewer & scanning
│   ├── providers/    # Context providers (theme, toast)
│   ├── search/       # Global search components
│   ├── study/        # Study session components
│   ├── tags/         # Tag management
│   └── ui/           # Custom primitives (Button, Card, Input) - NO external libs
├── hooks/            # Custom React hooks
├── lib/              # Pure functions & utilities
│   └── supabase/     # Supabase client setup (client.ts, server.ts)
├── types/            # TypeScript type definitions
│   ├── actions.ts    # Server action result types
│   ├── database.ts   # Database entity types
│   └── session.ts    # Study session types
├── utils/            # Legacy utilities
└── __tests__/        # Property-based tests (*.property.test.ts)

scripts/              # Database scripts (migrations, seed data)
schema.sql            # Full database schema with RLS policies