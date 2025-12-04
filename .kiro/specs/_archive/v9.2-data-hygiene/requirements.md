# Requirements Document

## Introduction

V9.2 "Data Hygiene & Retro-Tagging" provides tools to identify, fix, and auto-tag legacy cards that were created before the tagging system was implemented. This release ensures the entire database becomes consistent with proper tag categorization, enabling better filtering, study sessions, and content organization. The feature set includes an untagged card filter, AI-powered automatic tagging, and a tag merger utility for cleaning up duplicate or inconsistent tags.

## Glossary

- **Legacy Card**: A card_template created before the V9 tagging system, having zero associated tags
- **Untagged Card**: A card_template with `tags.length === 0` in the card_template_tags join
- **Retro-Tagging**: The process of applying tags to existing legacy cards retroactively
- **Golden List**: The curated set of standard Topic tags (e.g., Anatomy, Physiology, Pharmacology)
- **Tag Merger**: A utility to consolidate duplicate or variant tags into a single canonical tag
- **Source Tag**: The tag being merged/deleted during a merge operation
- **Target Tag**: The canonical tag that absorbs the source tag's associations

## Requirements

### Requirement 1: Untagged Card Filter

**User Story:** As a deck author, I want to filter my deck view to show only untagged cards, so that I can quickly identify and tag legacy content.

#### Acceptance Criteria

1. WHEN a deck author views the deck details page THEN the System SHALL display a "Show Untagged Only" toggle in the FilterBar component
2. WHEN the "Show Untagged Only" toggle is activated THEN the System SHALL filter the card list to display only cards where the tags array length equals zero
3. WHEN the "Show Untagged Only" toggle is deactivated THEN the System SHALL display all cards regardless of tag status
4. WHEN filtering is applied THEN the System SHALL update the card count indicator to reflect the filtered results
5. WHEN untagged cards are displayed THEN the System SHALL allow bulk selection for subsequent tagging operations

### Requirement 2: AI Retro-Tagger

**User Story:** As a deck author, I want to automatically tag selected cards using AI, so that I can efficiently categorize large numbers of legacy cards without manual effort.

#### Acceptance Criteria

1. WHEN cards are selected in the deck view THEN the System SHALL display an "Auto-Tag Selected" button in the bulk actions bar
2. WHEN the "Auto-Tag Selected" button is clicked THEN the System SHALL send the selected card content to OpenAI for classification
3. WHEN processing cards THEN the System SHALL limit batch size to 20 cards per API call to prevent timeouts
4. WHEN OpenAI returns classifications THEN the System SHALL assign one Topic tag from the Golden List and one to two Concept tags per card
5. WHEN saving tags THEN the System SHALL perform atomic upsert operations into card_template_tags
6. WHEN a card already has the suggested tag THEN the System SHALL skip that tag assignment without error
7. WHEN auto-tagging completes THEN the System SHALL display a success toast with the count of cards tagged
8. WHEN auto-tagging fails THEN the System SHALL display an error message and not leave partial state

### Requirement 3: Tag Merger Utility

**User Story:** As an administrator, I want to merge duplicate or variant tags into a single canonical tag, so that the tag taxonomy remains clean and consistent.

#### Acceptance Criteria

1. WHEN an administrator visits the /admin/tags page THEN the System SHALL display all tags with checkbox selection capability
2. WHEN multiple tags are selected THEN the System SHALL enable a "Merge Selected" action button
3. WHEN "Merge Selected" is clicked THEN the System SHALL open a modal prompting the user to choose the target tag
4. WHEN a target tag is selected and merge is confirmed THEN the System SHALL update all card_template_tags links from source tag IDs to the target tag ID
5. WHEN a card already has both the source and target tags THEN the System SHALL remove only the source tag link without creating duplicates
6. WHEN merge completes THEN the System SHALL delete the source tag records from the tags table
7. WHEN merge completes THEN the System SHALL display a success message with the count of affected cards
8. WHEN merge fails THEN the System SHALL rollback all changes and display an error message

### Requirement 4: Golden List Topic Tags

**User Story:** As a system, I need a predefined set of standard Topic tags, so that AI classification produces consistent categorization.

#### Acceptance Criteria

1. WHEN the AI retro-tagger classifies cards THEN the System SHALL reference a Golden List of approved Topic tags
2. WHEN generating Topic suggestions THEN the System SHALL only suggest tags from the Golden List
3. WHEN the Golden List is updated THEN the System SHALL use the updated list for subsequent classifications
4. THE Golden List SHALL include standard medical topics: Anatomy, Physiology, Pharmacology, Pathology, Obstetrics, Gynecology, Embryology, Genetics, Immunology, Microbiology, Biochemistry, Epidemiology, Biostatistics, Ethics
