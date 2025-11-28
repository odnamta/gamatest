# Design Document: V3 UX Overhaul

## Overview

The V3 UX Overhaul transforms Celline's OBGYN Prep from a feature-rich "cockpit" into a focused "companion" app. The primary change is introducing a Global Study Session that aggregates due cards across all decks, presented through a simplified Dashboard Hero. Secondary improvements include workflow visualization for bulk import and manual assist buttons.

This is a pure UI/UX refactor with no schema changes. All modifications are additive or UI-only, maintaining full compatibility with existing deck-specific study flows.

## Architecture

```mermaid
graph TB
    subgraph Dashboard
        Hero[Hero Section]
        Library[Library & Content - Collapsible]
    end
    
    subgraph Study Routes
        GlobalStudy[/study/global]
        DeckStudy[/study/deckId - existing]
    end
    
    subgraph Server Actions
        getGlobalDueCards[getGlobalDueCards]
        getGlobalStats[getGlobalStats]
        draftMCQFromText[draftMCQFromText - placeholder]
    end
    
    Hero --> |Start Today's Session| GlobalStudy
    Library --> DeckStudy
    GlobalStudy --> getGlobalDueCards
    Hero --> getGlobalStats
```

### Key Architectural Decisions

1. **Additive Changes Only**: New components and routes are added without modifying existing study flows
2. **Component Reuse**: GlobalStudySession wraps existing MCQStudySession and Flashcard components
3. **Server Actions Pattern**: New data fetching via server actions following existing patterns in `src/actions/`
4. **Mobile-First CSS**: All new components use Tailwind with mobile breakpoints as default

## Components and Interfaces

### New Components

#### 1. DashboardHero (`src/components/dashboard/DashboardHero.tsx`)
```typescript
interface DashboardHeroProps {
  globalDueCount: number
  completedToday: number
  dailyGoal: number | null
  hasNewCards: boolean
}
```
- Displays greeting, stats, and primary CTA
- Handles empty state when no cards available

#### 2. GlobalStudySession (`src/components/study/GlobalStudySession.tsx`)
```typescript
interface GlobalStudySessionProps {
  initialCards: (Card | MCQCard)[]
  totalDueRemaining: number
}

interface GlobalSessionState {
  currentIndex: number
  correctCount: number
  incorrectCount: number
  isComplete: boolean
}
```
- Wraps existing study components
- Tracks cross-deck session state
- Renders appropriate component based on card type

#### 3. GlobalStudySummary (`src/components/study/GlobalStudySummary.tsx`)
```typescript
interface GlobalStudySummaryProps {
  correctCount: number
  incorrectCount: number
  currentStreak: number
  remainingDueCount: number
}
```
- Displays session results
- Conditional "Continue Studying" button

#### 4. LibrarySection (`src/components/dashboard/LibrarySection.tsx`)
```typescript
interface LibrarySectionProps {
  courses: CourseWithProgress[]
  decks: DeckWithDueCount[]
  defaultExpanded?: boolean
}
```
- Collapsible container for courses and decks
- Includes "Add Deck" button

#### 5. BulkImportStepper (`src/components/cards/BulkImportStepper.tsx`)
```typescript
interface BulkImportStepperProps {
  currentStep: 1 | 2 | 3
  linkedSourceName?: string | null
}
```
- Visual breadcrumb for import workflow
- Green banner for linked PDF

#### 6. TextToStemButton (`src/components/cards/TextToStemButton.tsx`)
```typescript
interface TextToStemButtonProps {
  textAreaRef: React.RefObject<HTMLTextAreaElement>
  onTextSelected: (text: string) => void
}
```
- Reads selection from textarea
- Triggers toast on empty selection

### New Server Actions

#### `src/actions/global-study-actions.ts`

```typescript
// Fetch due cards across all decks
export async function getGlobalDueCards(): Promise<{
  cards: (Card | MCQCard)[]
  totalDue: number
  error?: string
}>

// Fetch global stats for dashboard hero
export async function getGlobalStats(): Promise<{
  totalDueCount: number
  completedToday: number
  hasNewCards: boolean
  error?: string
}>

// Placeholder for AI draft feature
export async function draftMCQFromText(text: string): Promise<{
  success: boolean
  mcq?: {
    question_stem: string
    options: string[]
    correct_index: number
    explanation: string
  }
  error?: string
}>
```

### New Routes

#### `/study/global/page.tsx`
- Server component that fetches global due cards
- Renders GlobalStudySession client component

## Data Models

No new database tables or schema changes. This feature uses existing tables:

- `cards` - Flashcards with SM-2 scheduling fields
- `mcq_cards` - Multiple choice questions
- `decks` - Card containers owned by users
- `user_stats` - Streak and review counts
- `study_logs` - Daily study activity
- `sources` - PDF source documents linked to decks

### Computed Data Structures

```typescript
// Global due cards query result
interface GlobalDueCardsResult {
  cards: (Card | MCQCard)[]
  totalDue: number
}

// Dashboard hero stats
interface GlobalStats {
  totalDueCount: number      // Sum of due cards across all decks
  completedToday: number     // From study_logs for today
  dailyGoal: number | null   // From user preferences (future)
  hasNewCards: boolean       // Cards with next_review = created_at
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Global due count accuracy
*For any* user with multiple decks containing cards with various `next_review` timestamps, the computed `totalDueCount` SHALL equal the sum of cards where `next_review <= now` across all user-owned decks.

**Validates: Requirements 1.2**

### Property 2: Daily progress calculation
*For any* user with study logs, the `completedToday` count SHALL equal the `cards_reviewed` value from the study_log entry for today's date, or 0 if no entry exists.

**Validates: Requirements 1.3, 1.4**

### Property 3: Global due cards ordering and limit
*For any* set of due cards across multiple decks, `getGlobalDueCards()` SHALL return cards ordered by `next_review` ascending, limited to 50 cards maximum.

**Validates: Requirements 2.2**

### Property 4: New cards fallback
*For any* user with zero due cards but existing new cards (never reviewed), `getGlobalDueCards()` SHALL return up to 10 new cards ordered by `created_at` ascending.

**Validates: Requirements 2.3**

### Property 5: Session summary state consistency
*For any* sequence of answers in a global study session, the summary SHALL display `correctCount` equal to the number of correct answers and `incorrectCount` equal to the number of incorrect answers, where `correctCount + incorrectCount` equals total cards answered.

**Validates: Requirements 2.5, 6.1**

### Property 6: Text selection transfer
*For any* non-empty text selection in the PDF text area, clicking the copy button SHALL result in the Question Stem field containing exactly that selected text.

**Validates: Requirements 5.2**

### Property 7: Continue button conditional display
*For any* global study session completion, the "Continue Studying" button SHALL be visible if and only if `remainingDueCount > 0`.

**Validates: Requirements 6.3, 6.4**

## Error Handling

### Server Action Errors
- Authentication failures return `{ success: false, error: 'Authentication required' }`
- Database errors return `{ success: false, error: <message> }`
- Empty results return empty arrays, not errors

### Client-Side Errors
- Toast notifications for user-facing errors (e.g., "Select text in the left box first.")
- Loading states during async operations
- Graceful degradation when stats unavailable

### Edge Cases
- User with no decks: Show empty state in hero
- User with decks but no cards: Show empty state with bulk import prompt
- Mixed card types (flashcards + MCQs): GlobalStudySession handles both
- Session interrupted: State persists in component, no server-side session tracking

## Testing Strategy

### Property-Based Testing

The project uses **Vitest** with **fast-check** for property-based testing, following the existing pattern in `src/__tests__/*.property.test.ts`.

Each correctness property will be implemented as a property-based test:
- Property tests run minimum 100 iterations
- Tests are tagged with format: `**Feature: v3-ux-overhaul, Property {number}: {property_text}**`
- Generators create random but valid test data (decks, cards, timestamps)

### Unit Testing

Unit tests complement property tests for:
- Specific edge cases (empty arrays, null values)
- Component rendering with specific props
- Server action error paths

### Test File Locations

```
src/__tests__/
  global-due-count.property.test.ts    # Property 1
  daily-progress.property.test.ts      # Property 2
  global-cards-ordering.property.test.ts # Property 3
  new-cards-fallback.property.test.ts  # Property 4
  session-summary.property.test.ts     # Property 5
  text-selection.property.test.ts      # Property 6
  continue-button.property.test.ts     # Property 7
```

### Testing Approach

1. **Pure Logic Testing**: Extract computation logic into pure functions in `src/lib/` for easy testing
2. **No Mocking**: Tests validate real logic, not mocked behavior
3. **Smart Generators**: Constrain random data to valid domain (e.g., valid UUIDs, realistic timestamps)
