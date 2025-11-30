# Design Document: Library UX & Adoption (V6.5)

## Overview

The Library UX & Adoption feature introduces a marketplace-style interface for discovering and subscribing to shared deck templates. It builds on the V2 Shared Schema established in V6.4, separating content (deck_templates, card_templates) from user progress (user_decks, user_card_progress). The key architectural principle is "lazy seeding" — user progress records are only created when cards are actually studied, not when subscribing to a deck.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  /library (Browse)          │  /library/my (My Library)         │
│  - LibraryGrid              │  - MyLibraryGrid                  │
│  - DeckBrowseCard           │  - MyDeckCard                     │
│  - Subscribe button         │  - Unsubscribe action             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server Actions Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  library-actions.ts                                              │
│  - getBrowseDecksForUser()   → Visibility-filtered deck list    │
│  - subscribeToDeck()         → Upsert user_decks (lazy)         │
│  - getUserSubscribedDecks()  → Active subscriptions + stats     │
│  - unsubscribeFromDeck()     → Soft delete (is_active=false)    │
├─────────────────────────────────────────────────────────────────┤
│  global-study-actions.ts (V2 Updates)                           │
│  - getGlobalDueCardsV2()     → Active-subscription-only query   │
│  - upsertCardProgress()      → Lazy progress creation           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer (V2 Schema)                    │
├─────────────────────────────────────────────────────────────────┤
│  Content Layer (Shared)     │  Progress Layer (Per-User)        │
│  - deck_templates           │  - user_decks (subscriptions)     │
│  - card_templates           │  - user_card_progress (SRS state) │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Server Actions

#### `getBrowseDecksForUser(): Promise<BrowseDeckItem[]>`
Fetches deck templates visible to the current user for the library browse page.

```typescript
interface BrowseDeckItem {
  id: string
  title: string
  description: string | null
  visibility: 'public' | 'private'
  author_id: string
  card_count: number
  isSubscribed: boolean
  isAuthor: boolean
  created_at: string
}
```

**Query Logic:**
1. SELECT from `deck_templates` WHERE `visibility = 'public'` OR `author_id = auth.uid()`
2. LEFT JOIN `user_decks` to determine `isSubscribed` (where `user_id = auth.uid()` AND `is_active = true`)
3. COUNT `card_templates` per deck for `card_count`
4. Compute `isAuthor = (author_id === auth.uid())`

#### `subscribeToDeck(deckTemplateId: string): Promise<ActionResult>`
Creates or reactivates a subscription to a deck template.

**Logic:**
1. Validate deck is visible to user (visibility = 'public' OR author_id = user_id)
2. UPSERT into `user_decks` with `(user_id, deck_template_id, is_active: true)`
3. On conflict: SET `is_active = true` (reactivation)
4. Do NOT create any `user_card_progress` records

#### `getUserSubscribedDecks(): Promise<MyDeckItem[]>`
Fetches the user's actively subscribed decks with study statistics.

```typescript
interface MyDeckItem {
  id: string
  title: string
  description: string | null
  card_count: number
  due_count: number
  new_count: number
  isAuthor: boolean
  created_at: string
}
```

**Query Logic:**
1. SELECT from `deck_templates` JOIN `user_decks` WHERE `user_id = auth.uid()` AND `is_active = true`
2. COUNT `card_templates` per deck for `card_count`
3. COUNT `user_card_progress` WHERE `next_review <= now()` for `due_count`
4. COUNT cards without progress for `new_count`

#### `unsubscribeFromDeck(deckTemplateId: string): Promise<ActionResult>`
Soft-deletes a subscription by setting is_active to false.

**Logic:**
1. UPDATE `user_decks` SET `is_active = false` WHERE `user_id = auth.uid()` AND `deck_template_id = ?`
2. Do NOT delete any `user_card_progress` records (preserve SRS data)

### UI Components

#### `DeckBrowseCard`
Displays a deck template in the library browse view.

**Props:**
```typescript
interface DeckBrowseCardProps {
  deck: BrowseDeckItem
  onSubscribe: (deckId: string) => Promise<void>
}
```

**Behavior:**
- Shows title, description (truncated), card count
- Badge: "Created by you" if `isAuthor = true`
- Button: "Add to My Studies" if not subscribed, "Go to My Library" if subscribed

#### `MyDeckCard`
Displays a subscribed deck in the My Library view.

**Props:**
```typescript
interface MyDeckCardProps {
  deck: MyDeckItem
  onUnsubscribe: (deckId: string) => Promise<void>
}
```

**Behavior:**
- Shows title, card count, due count badge
- Button: "Continue Study" / "Start Today"
- Menu: "Unsubscribe" action with confirmation

## Data Models

### Existing V2 Schema (from V6.4)

```sql
-- deck_templates: Shared content container
CREATE TABLE deck_templates (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT CHECK (visibility IN ('private', 'public')),
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ
);

-- card_templates: MCQ content
CREATE TABLE card_templates (
  id UUID PRIMARY KEY,
  deck_template_id UUID REFERENCES deck_templates(id),
  stem TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ
);

-- user_decks: Subscription records
CREATE TABLE user_decks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  deck_template_id UUID REFERENCES deck_templates(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, deck_template_id)
);

-- user_card_progress: Per-user SRS state (lazy creation)
CREATE TABLE user_card_progress (
  user_id UUID REFERENCES auth.users(id),
  card_template_id UUID REFERENCES card_templates(id),
  interval INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, card_template_id)
);
```

### New Types

```typescript
// src/types/database.ts additions

interface BrowseDeckItem {
  id: string
  title: string
  description: string | null
  visibility: DeckVisibility
  author_id: string
  card_count: number
  isSubscribed: boolean
  isAuthor: boolean
  created_at: string
}

interface MyDeckItem {
  id: string
  title: string
  description: string | null
  card_count: number
  due_count: number
  new_count: number
  isAuthor: boolean
  created_at: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Visibility Filter Correctness
*For any* user and any set of deck_templates, the browse query should return exactly those decks where `visibility = 'public'` OR `author_id = user_id`, and no others.
**Validates: Requirements 1.1**

### Property 2: Subscription Status Accuracy
*For any* deck_template and user, the `isSubscribed` flag should be true if and only if a `user_decks` record exists with `user_id = auth.uid()` AND `deck_template_id = deck.id` AND `is_active = true`.
**Validates: Requirements 1.4, 2.1**

### Property 3: Subscription Reactivation Round-Trip
*For any* deck that was previously unsubscribed (is_active = false), subscribing again should result in `is_active = true` for the same user_decks record.
**Validates: Requirements 2.2**

### Property 4: Subscription Visibility Validation
*For any* deck_template where `visibility = 'private'` AND `author_id != user_id`, attempting to subscribe should fail with an authorization error.
**Validates: Requirements 2.3**

### Property 5: Lazy Seeding Invariant (Subscribe)
*For any* subscription action, the count of `user_card_progress` records for the user should remain unchanged immediately after subscribing.
**Validates: Requirements 2.5**

### Property 6: My Library Active-Only Filter
*For any* user, the My Library query should return exactly those deck_templates where a `user_decks` record exists with `is_active = true`, and exclude all decks with `is_active = false`.
**Validates: Requirements 3.1**

### Property 7: Due Count Accuracy
*For any* subscribed deck, the `due_count` should equal the count of `user_card_progress` records where `card_template.deck_template_id = deck.id` AND `next_review <= now()`.
**Validates: Requirements 3.3**

### Property 8: Unsubscribe Soft Delete
*For any* unsubscribe action on an active subscription, the `user_decks.is_active` flag should be set to false, and the record should not be deleted.
**Validates: Requirements 4.1**

### Property 9: Progress Preservation on Unsubscribe
*For any* unsubscribe action, the count of `user_card_progress` records for cards in that deck should remain unchanged.
**Validates: Requirements 4.2**

### Property 10: Study Query Active-Subscription Filter
*For any* study query (getGlobalDueCardsV2), all returned cards should belong to deck_templates where the user has an active subscription (`user_decks.is_active = true`).
**Validates: Requirements 5.1**

### Property 11: New Card Eligibility
*For any* card_template in an actively subscribed deck that has no `user_card_progress` record, the card should be eligible for inclusion in study sessions as a "new card".
**Validates: Requirements 5.2**

### Property 12: Lazy Progress Creation on First Answer
*For any* card answered for the first time (no existing progress), a `user_card_progress` record should be created with valid initial SRS values.
**Validates: Requirements 5.3**

### Property 13: Global Due Count Active-Only
*For any* global stats query, the `totalDueCount` should only include cards from deck_templates where the user has an active subscription.
**Validates: Requirements 5.5**

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| User not authenticated | Return error with "Authentication required" message |
| Deck not visible to user | Return error with "Deck not found or not accessible" |
| Subscription already exists | Upsert handles gracefully (reactivation) |
| Database connection failure | Return error, log to console, show user-friendly message |
| Invalid deck_template_id | Validate UUID format, return "Invalid deck ID" error |

## Testing Strategy

### Unit Testing
- Test visibility filter logic with mock data
- Test subscription/unsubscription state transitions
- Test due count calculation logic

### Property-Based Testing
Property-based tests will use `fast-check` (already in devDependencies) to verify the correctness properties above. Each property test will:
- Generate random deck_templates, users, and subscription states
- Execute the relevant server action or query
- Assert the property holds across all generated inputs
- Run minimum 100 iterations per property

**Test File:** `src/__tests__/library-subscription.property.test.ts`

**Property Test Annotations:**
Each property-based test must include a comment referencing the correctness property:
```typescript
// **Feature: library-ux-adoption, Property 1: Visibility Filter Correctness**
```

### Integration Testing
- Test full subscribe → study → unsubscribe flow
- Verify lazy seeding behavior end-to-end
- Test reactivation after unsubscribe
