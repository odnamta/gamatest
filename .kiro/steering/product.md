# Product Overview

**Specialize** is a spaced repetition learning application for medical board exam preparation. Built for busy medical residents with a mobile-first, "Clinical Glass" aesthetic.

## Target Audience

- Medical Residents preparing for board exams
- Mobile-first users (tired eyes, on-the-go studying)
- Initially focused on OBGYN, expandable to other specialties

## Core Features

- **Flashcards & MCQs**: Dual card types with markdown rendering support
- **SM-2 Algorithm**: Spaced repetition scheduling based on user performance (Again/Hard/Good/Easy ratings)
- **Bulk Import**: Create MCQs from PDF source materials with AI assistance
- **Shared Library**: Deck templates that can be public or private, with subscription model
- **Gamification**: Daily streaks, study heatmaps, and progress tracking
- **Digital Notebook**: Flag cards, add personal notes, search across all content
- **PWA Support**: Installable on mobile devices for offline-like experience

## Authentication

- **Google OAuth ONLY** - No email/password flows
- New users go through "Welcome Wizard" (Specialty Selection) before Dashboard

## Data Architecture

The app uses a two-layer data model:
1. **Content Layer**: `deck_templates` and `card_templates` (Shared)
2. **Progress Layer**: `user_decks` and `user_card_progress` (Private)

### Permissions
- **Students**: READ templates, WRITE progress
- **Authors**: WRITE templates, WRITE progress

## Key User Flows

1. Sign in with Google → Welcome Wizard (first time)
2. Browse/subscribe to deck templates in the library
3. Study due cards with spaced repetition scheduling
4. Create custom decks and cards (flashcards or MCQs)
5. Track progress via dashboard (streaks, heatmap, due counts)
6. Flag cards and add notes during study sessions
