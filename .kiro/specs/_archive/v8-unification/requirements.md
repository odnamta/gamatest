# Requirements Document

## Introduction

V8.0 "The Great Unification" is a migration initiative to eliminate the hybrid V1/V2 schema state in Celline's OBGYN Prep application. Currently, the application maintains two parallel data models: the legacy schema (`decks`, `cards`, `card_tags`) and the V2 Shared Schema (`deck_templates`, `card_templates`, `card_template_tags`, `user_decks`, `user_card_progress`). This dual-state causes "Deck ID Mismatch" bugs, "Zombie Card" issues where cards appear in one schema but not the other, and complex fallback logic throughout the codebase. This migration will pour all remaining legacy data into V2 tables and hard-switch the application to use V2 exclusively.

## Glossary

- **Legacy Schema (V1)**: The original database tables (`decks`, `cards`, `card_tags`) that store deck and card data with embedded SRS state
- **V2 Shared Schema**: The new normalized schema separating content (`deck_templates`, `card_templates`) from user progress (`user_decks`, `user_card_progress`)
- **Migration Function**: SQL function `migrate_v1_to_v2()` that copies data from legacy tables to V2 tables
- **legacy_id**: UUID column in V2 tables that links back to the original V1 record ID for migration tracking
- **Hybrid State**: Current application state where code paths may query either V1 or V2 tables depending on conditions
- **Hard Switch**: Removing all V1 fallback code paths so the application exclusively uses V2 tables
- **Zombie Card**: A card that exists in one schema but not the other, causing display inconsistencies
- **SRS State**: Spaced Repetition System fields (interval, ease_factor, next_review) that track learning progress

## Requirements

### Requirement 1: Complete Data Migration

**User Story:** As a system administrator, I want all legacy card data migrated to the V2 schema, so that no user data is lost during the transition.

#### Acceptance Criteria

1. WHEN the migration function executes THEN the System SHALL insert all rows from `cards` table that do not have a matching `legacy_id` in `card_templates` into the `card_templates` table
2. WHEN a legacy card is migrated THEN the System SHALL create a corresponding `user_card_progress` row preserving the original SRS state (interval, ease_factor, next_review)
3. WHEN a legacy card has tags in `card_tags` THEN the System SHALL create corresponding rows in `card_template_tags` linking to the migrated card_template
4. WHEN the migration function runs multiple times THEN the System SHALL produce identical results (idempotent operation)
5. WHEN a legacy deck exists without a corresponding `deck_template` THEN the System SHALL create the deck_template with `legacy_id` set to the original deck ID

### Requirement 2: Code Path Cutover

**User Story:** As a developer, I want all application code to use V2 tables exclusively, so that the codebase is simplified and bugs from hybrid state are eliminated.

#### Acceptance Criteria

1. WHEN the deck details page loads THEN the System SHALL query only `deck_templates` and `card_templates` tables
2. WHEN a user creates a new card THEN the System SHALL insert into `card_templates` and `user_card_progress` tables only
3. WHEN a user updates a card THEN the System SHALL update the `card_templates` table only
4. WHEN a user deletes a card THEN the System SHALL delete from `card_templates` table only
5. WHEN fetching due cards for study THEN the System SHALL query `user_card_progress` joined with `card_templates` only
6. WHEN the `USE_V2_SCHEMA` flag is referenced THEN the System SHALL treat it as permanently true with no fallback paths

### Requirement 3: Migration Verification

**User Story:** As a system administrator, I want to verify that all data was migrated correctly, so that I can be confident no data was lost.

#### Acceptance Criteria

1. WHEN the application starts THEN the System SHALL log a migration report showing count of records in legacy `cards` table
2. IF the count of records in legacy `cards` table exceeds zero THEN the System SHALL log a warning recommending the migration script be run
3. WHEN the migration function completes THEN the System SHALL return a JSON report with counts of migrated deck_templates, card_templates, card_template_tags, and user_card_progress records
4. WHEN comparing legacy and V2 data THEN the System SHALL verify that card content (stem, options, correct_index, explanation) matches exactly

### Requirement 4: Backward Compatibility Removal

**User Story:** As a developer, I want legacy fallback code removed, so that the codebase is cleaner and easier to maintain.

#### Acceptance Criteria

1. WHEN a card operation receives a legacy deck ID THEN the System SHALL fail with a clear error message instead of attempting fallback resolution
2. WHEN the `bulkCreateMCQ` V1 function is called THEN the System SHALL redirect to `bulkCreateMCQV2` without legacy table writes
3. WHEN the `getGlobalDueCards` V1 function is called THEN the System SHALL redirect to `getGlobalDueCardsV2` without legacy table queries
4. WHEN hybrid merging logic exists in deck fetching THEN the System SHALL remove it in favor of V2-only queries
