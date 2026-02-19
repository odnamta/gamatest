# Cekatan

A multi-tenant assessment and study platform for organizations. Supports two modes: **Study Mode** (spaced repetition, flashcards, self-paced learning) and **Assessment Mode** (timed tests, proctoring, scoring, certification).

## Features

- **Spaced Repetition (SM-2)** — Optimized review scheduling based on performance
- **MCQ Engine** — Multiple-choice questions with auto-grading
- **AI Content Generation** — Create MCQs from PDFs with GPT-4 Vision
- **Multi-Tenant** — Organizations with role-based access (owner/admin/creator/candidate)
- **Feature Flags** — Enable/disable features per organization
- **Analytics** — Study heatmaps, topic accuracy radar, skill gap analysis
- **Dark Mode** — Full dark mode support with WCAG AA contrast compliance
- **Mobile-First** — Responsive design, PWA support

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL + Auth + RLS + Storage)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Testing:** Vitest + fast-check (property-based testing)
- **Validation:** Zod
- **AI:** OpenAI SDK

## Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd cekatan
npm install
```

### 2. Set Up Supabase
1. Create a new Supabase project
2. Go to **SQL Editor** and run `schema.sql`
3. Enable Google Auth in **Authentication > Providers**

### 3. Configure Environment Variables
```bash
cp .env.local.example .env.local
```

Required variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run seed` | Seed database with sample data |

## Project Structure

```
src/
├── actions/        # Server Actions (mutations)
├── app/            # Next.js App Router pages
├── components/     # React components (by feature domain)
│   └── ui/         # Reusable UI primitives
├── hooks/          # Custom React hooks
├── lib/            # Pure functions & utilities
├── types/          # TypeScript type definitions
└── __tests__/      # Property-based tests
```

## Testing

Property-based testing with fast-check:

```bash
npm run test
```

Tests cover core algorithms (SM-2, streak), authorization, validation, and UI properties.

## License

Private project.
