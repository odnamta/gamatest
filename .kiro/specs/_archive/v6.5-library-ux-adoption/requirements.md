# Requirements Document

## Introduction

This specification defines the Library UX & Adoption feature (V6.5) for Celline's OBGYN Prep application. The feature enables users to discover shared deck templates in a marketplace-style library, subscribe to decks for personal study, and manage their subscribed decks. The system leverages the V2 Shared Schema (`deck_templates`, `card_templates`, `user_decks`, `user_card_progress`) to separate content from user progress, enabling a "lazy seeding" approach where SRS progress records are only created when cards are actually studied.

## Glossary

- **Deck_Template:** A shared content container holding card templates, with visibility controls (public/private) and author ownership.
- **Card_Template:** An MCQ question belonging to a deck_template, containing stem, options, correct_index, and explanation.
- **User_Decks:** A subscription record linking a user to a deck_template, with an `is_active` flag for soft unsubscribe.
- **User_Card_Progress:** Per-user SRS state for a card_template, created lazily on first answer.
- **Library:** The marketplace view showing discoverable deck_templates.
- **My Library:** The personal dashboard showing a user's actively subscribed decks.
- **Subscription:** The act of adding a deck_template to a user's study collection via user_decks.
- **Lazy Seeding:** The pattern where user_card_progress rows are created only when a card is first answered, not when subscribing.
- **Due Card:** A card where the user's progress record has `next_review <= now()`, or a new card with no progress record.

## Requirements

### Requirement 1: Library Browse Page

**User Story:** As a user, I want to browse available deck templates in a library, so that I can discover new study materials to add to my collection.

#### Acceptance Criteria

1. WHEN a user navigates to the library page, THE System SHALL display all deck_templates where visibility equals 'public' OR author_id equals the current user's ID.
2. WHEN displaying deck_templates, THE System SHALL show the title, description, and card count for each deck.
3. WHEN a deck_template is authored by the current user, THE System SHALL display a visual indicator distinguishing authored decks from other public decks.
4. WHEN a user is already subscribed to a deck_template, THE System SHALL display the subscription status on the deck card.
5. WHEN no deck_templates match the visibility criteria, THE System SHALL display an empty state message indicating no decks are available.

### Requirement 2: Deck Subscription

**User Story:** As a user, I want to subscribe to deck templates from the library, so that I can add them to my personal study collection.

#### Acceptance Criteria

1. WHEN a user clicks the subscribe button on an unsubscribed deck, THE System SHALL create a user_decks record with is_active set to true.
2. WHEN a user subscribes to a previously unsubscribed deck, THE System SHALL reactivate the existing user_decks record by setting is_active to true.
3. WHEN a user attempts to subscribe to a deck, THE System SHALL validate that the deck is visible to the user before creating the subscription.
4. WHEN subscription succeeds, THE System SHALL update the UI to reflect the new subscription status without requiring a page refresh.
5. WHEN a user subscribes to a deck, THE System SHALL NOT create any user_card_progress records for the deck's cards.

### Requirement 3: My Library View

**User Story:** As a user, I want to view my subscribed decks in a personal library, so that I can manage and access my study materials.

#### Acceptance Criteria

1. WHEN a user navigates to the My Library page, THE System SHALL display all deck_templates where the user has an active subscription (user_decks.is_active equals true).
2. WHEN displaying subscribed decks, THE System SHALL show the title, total card count, and due card count for each deck.
3. WHEN a subscribed deck has due cards, THE System SHALL display the due count prominently on the deck card.
4. WHEN a user has no active subscriptions, THE System SHALL display an empty state with guidance to browse the library.
5. WHEN displaying subscribed decks, THE System SHALL provide a clear entry point to start studying the deck.

### Requirement 4: Deck Unsubscription

**User Story:** As a user, I want to unsubscribe from decks I no longer want to study, so that I can keep my library focused on relevant materials.

#### Acceptance Criteria

1. WHEN a user clicks the unsubscribe action on a subscribed deck, THE System SHALL set the user_decks.is_active flag to false.
2. WHEN a user unsubscribes from a deck, THE System SHALL preserve all existing user_card_progress records for that deck's cards.
3. WHEN unsubscription succeeds, THE System SHALL remove the deck from the My Library view without requiring a page refresh.
4. WHEN a user unsubscribes from a deck, THE System SHALL display confirmation feedback indicating the action completed successfully.

### Requirement 5: V2 Study Integration

**User Story:** As a user, I want to study cards only from my actively subscribed decks, so that my study sessions reflect my current learning goals.

#### Acceptance Criteria

1. WHEN fetching due cards for study, THE System SHALL only include cards from deck_templates where the user has an active subscription.
2. WHEN a card has no user_card_progress record, THE System SHALL treat the card as a new card eligible for study.
3. WHEN a user answers a card for the first time, THE System SHALL create a user_card_progress record with initial SRS values.
4. WHEN a user answers a card with existing progress, THE System SHALL update the user_card_progress record according to SM-2 algorithm.
5. WHEN calculating global due counts, THE System SHALL only count cards from actively subscribed deck_templates.

### Requirement 6: Navigation Integration

**User Story:** As a user, I want to easily navigate between the library and my personal collection, so that I can efficiently manage my study materials.

#### Acceptance Criteria

1. WHEN viewing the application, THE System SHALL provide navigation links to both the Library browse page and My Library page.
2. WHEN a user subscribes to a deck from the library, THE System SHALL provide a clear path to navigate to My Library.
3. WHEN viewing My Library, THE System SHALL provide a clear path to browse more decks in the Library.
