# Requirements Document

## Introduction

Celline's OBGYN Prep is a high-performance, secure, server-first Spaced Repetition System (SRS) designed specifically for medical entrance exam preparation. The system implements the SM-2 algorithm for intelligent card scheduling and uses a modern Next.js 14+ stack with Supabase for authentication and data persistence.

## Glossary

- **SRS (Spaced Repetition System):** A learning technique that incorporates increasing intervals of time between subsequent reviews of previously learned material to exploit the psychological spacing effect.
- **SM-2 Algorithm:** A spaced repetition algorithm that calculates optimal review intervals based on user performance ratings.
- **Deck:** A collection of flashcards grouped by topic or subject.
- **Card:** A single flashcard containing a front (question) and back (answer) with optional image.
- **Interval:** The number of days until the next scheduled review of a card.
- **Ease Factor:** A multiplier (minimum 1.3) that determines how quickly intervals grow based on card difficulty.
- **Due Card:** A card whose `next_review` timestamp is less than or equal to the current time.
- **RSC (React Server Component):** A React component that renders on the server and sends HTML to the client.
- **Server Action:** A Next.js feature that allows server-side mutations without API routes.
- **RLS (Row Level Security):** A PostgreSQL feature that restricts which rows users can access based on policies.

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to register and log in to the application, so that I can securely access my personal flashcard decks.

#### Acceptance Criteria

1. WHEN a user submits the registration form with valid email and password, THE Authentication System SHALL create a new user account in Supabase Auth and redirect to the dashboard.
2. WHEN a user submits the login form with valid credentials, THE Authentication System SHALL authenticate the user via Supabase Auth and redirect to the dashboard.
3. WHEN a user submits invalid or malformed input, THE Authentication System SHALL display validation errors using Zod schema validation.
4. WHEN an unauthenticated user attempts to access protected routes, THE Authentication System SHALL redirect the user to the login page.
5. WHEN a user clicks the logout button, THE Authentication System SHALL terminate the session and redirect to the landing page.

### Requirement 2: Deck Management

**User Story:** As a user, I want to create and manage flashcard decks, so that I can organize my study materials by topic.

#### Acceptance Criteria

1. WHEN a user submits the create deck form with a valid title, THE Deck Management System SHALL create a new deck linked to the authenticated user and display it on the dashboard.
2. WHEN a user views the dashboard, THE Deck Management System SHALL display only decks owned by the authenticated user.
3. WHEN a user deletes a deck, THE Deck Management System SHALL remove the deck and all associated cards from the database.
4. WHEN a deck is created, THE Database System SHALL enforce RLS policies ensuring users can only access their own decks.

### Requirement 3: Card Management

**User Story:** As a user, I want to create flashcards with questions, answers, and optional images, so that I can build my study materials.

#### Acceptance Criteria

1. WHEN a user submits the create card form with valid front text, back text, and optional image URL, THE Card Management System SHALL create a new card with default SM-2 values (interval: 0, ease_factor: 2.5, next_review: now).
2. WHEN a user provides an image URL, THE Card Management System SHALL store the URL and display the image on the card front during study.
3. WHEN a card is created, THE Database System SHALL enforce RLS policies ensuring users can only access cards belonging to their own decks.
4. WHEN a deck is deleted, THE Database System SHALL cascade delete all cards belonging to that deck.

### Requirement 4: SM-2 Spaced Repetition Algorithm

**User Story:** As a user, I want the system to schedule my card reviews using the SM-2 algorithm, so that I can learn efficiently with optimal spacing.

#### Acceptance Criteria

1. WHEN a user rates a card as "Again" (rating 1), THE SM-2 Algorithm SHALL reset the interval to 0 and set next_review to 1 minute from now.
2. WHEN a user rates a card as "Hard" (rating 2), THE SM-2 Algorithm SHALL multiply the interval by 1.2, decrease the ease factor (minimum 1.3), and calculate the next review date.
3. WHEN a user rates a card as "Good" (rating 3), THE SM-2 Algorithm SHALL multiply the interval by the current ease factor and calculate the next review date.
4. WHEN a user rates a card as "Easy" (rating 4), THE SM-2 Algorithm SHALL multiply the interval by (ease factor + 0.15), increase the ease factor, and calculate the next review date.
5. WHEN the SM-2 Algorithm calculates a new interval, THE System SHALL ensure the ease factor never falls below 1.3.
6. WHEN the SM-2 Algorithm processes a rating, THE System SHALL serialize the card state to JSON and deserialize it back to verify round-trip consistency.

### Requirement 5: Study Mode

**User Story:** As a user, I want to study my due flashcards in an interactive session, so that I can review and reinforce my knowledge.

#### Acceptance Criteria

1. WHEN a user enters study mode for a deck, THE Study System SHALL fetch all cards where next_review is less than or equal to the current timestamp.
2. WHEN displaying a card, THE Study System SHALL show only the front content initially with a "Reveal" button.
3. WHEN a user clicks the "Reveal" button, THE Study System SHALL display the back content and rating buttons (Again, Hard, Good, Easy).
4. WHEN a user clicks a rating button, THE Study System SHALL execute a Server Action to update the card using SM-2 logic and fetch the next due card.
5. WHEN no due cards remain in the deck, THE Study System SHALL display a completion message indicating the study session is complete.
6. WHEN a card has an image URL, THE Study System SHALL render the image alongside the front content.

### Requirement 6: Dashboard

**User Story:** As a user, I want to see an overview of my decks with due card counts, so that I can prioritize my study sessions.

#### Acceptance Criteria

1. WHEN a user views the dashboard, THE Dashboard System SHALL display all user-owned decks as a React Server Component.
2. WHEN displaying a deck, THE Dashboard System SHALL show the deck title and the count of cards currently due for review.
3. WHEN a user clicks on a deck, THE Dashboard System SHALL navigate to the study mode for that deck.
4. WHEN a user has no decks, THE Dashboard System SHALL display an empty state with a prompt to create a new deck.

### Requirement 7: Landing Page

**User Story:** As a visitor, I want to see an informative landing page, so that I can understand the application and access login.

#### Acceptance Criteria

1. WHEN a visitor loads the landing page, THE Landing Page SHALL display a hero section describing the application purpose.
2. WHEN a visitor clicks the "Login" button, THE Landing Page SHALL navigate to the login page.

### Requirement 8: Database Security

**User Story:** As a system administrator, I want all user data protected by Row Level Security, so that users can only access their own data.

#### Acceptance Criteria

1. WHEN a deck table row is accessed, THE RLS Policy SHALL verify the requesting user's ID matches the deck's user_id.
2. WHEN a card table row is accessed, THE RLS Policy SHALL verify the requesting user owns the parent deck using an EXISTS clause.
3. WHEN the database schema is created, THE Schema SHALL link all user tables to auth.users via user_id foreign key.

### Requirement 9: Input Validation

**User Story:** As a developer, I want all user inputs validated with Zod schemas, so that the application handles data consistently and securely.

#### Acceptance Criteria

1. WHEN any form is submitted, THE Validation System SHALL validate all inputs against a Zod schema before processing.
2. WHEN validation fails, THE Validation System SHALL return structured error messages for display to the user.
3. WHEN Server Actions receive data, THE Validation System SHALL re-validate inputs server-side regardless of client validation.
