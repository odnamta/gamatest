# Requirements Document

## Introduction

V9.5 "Data Hygiene (The Cleanup Suite)" extends the Tag Manager with advanced administrative tools to maintain database health. Building on V9.2's merge functionality, this release adds inline tag renaming with duplicate detection, an auto-formatter for consistent tag naming, and improves the existing untagged card discovery workflow.

The goal is to give deck authors and admins a complete toolkit for cleaning up messy tag data that accumulates over time from AI-generated tags and manual entry.

## Glossary

- **Tag Merger**: The existing V9.2 feature that combines multiple tags into a single target tag, transferring all card associations
- **Inline Rename**: Editing a tag name directly in the Tag Manager list without opening a modal
- **Duplicate Detection**: Checking if a proposed tag name already exists before saving
- **Auto-Formatter**: A utility that normalizes tag names to Title Case and removes extra whitespace
- **Title Case**: Capitalization style where the first letter of each word is uppercase (e.g., "pelvic floor" → "Pelvic Floor")
- **Collision**: When auto-formatting would create a tag name that already exists
- **Untagged Card**: A card_template with zero associated tags in the card_template_tags junction table

## Requirements

### Requirement 1: Inline Tag Renaming

**User Story:** As an admin, I want to rename tags directly in the Tag Manager list, so that I can quickly fix typos and standardize naming without navigating away.

#### Acceptance Criteria

1. WHEN an admin clicks the edit icon next to a tag name THEN the System SHALL replace the tag name text with an editable input field
2. WHEN the admin presses Enter or clicks outside the input THEN the System SHALL save the new tag name
3. WHEN the admin presses Escape THEN the System SHALL cancel the edit and restore the original name
4. WHEN the admin submits a new name that matches an existing tag THEN the System SHALL display a prompt offering to merge the tags
5. WHEN the admin submits an empty or whitespace-only name THEN the System SHALL reject the change and display a validation error

### Requirement 2: Tag Rename Server Action

**User Story:** As a developer, I want a server action for renaming tags with duplicate detection, so that the rename logic is centralized and secure.

#### Acceptance Criteria

1. WHEN `renameTag` is called with a valid new name THEN the System SHALL update the tag name in the database
2. WHEN `renameTag` detects the new name matches an existing tag THEN the System SHALL return a conflict response with the existing tag's ID
3. WHEN `renameTag` receives an empty name THEN the System SHALL return a validation error
4. WHEN `renameTag` completes successfully THEN the System SHALL revalidate the `/admin/tags` path

### Requirement 3: Auto-Format Tags Utility

**User Story:** As an admin, I want to auto-format all tags to Title Case, so that tag names are consistent and professional-looking.

#### Acceptance Criteria

1. WHEN the admin clicks "Auto-Format Tags" THEN the System SHALL process all tags owned by the user
2. WHEN formatting a tag name THEN the System SHALL convert the name to Title Case and trim whitespace
3. WHEN auto-formatting would create a duplicate name THEN the System SHALL skip that tag and add it to a warning list
4. WHEN auto-formatting completes THEN the System SHALL display a summary showing tags updated and tags skipped due to collisions
5. WHEN no tags require formatting THEN the System SHALL display a message indicating all tags are already formatted

### Requirement 4: Auto-Format Server Action

**User Story:** As a developer, I want a server action for bulk auto-formatting tags, so that the formatting logic runs securely on the server.

#### Acceptance Criteria

1. WHEN `autoFormatTags` is called THEN the System SHALL retrieve all tags for the authenticated user
2. WHEN processing each tag THEN the System SHALL check if Title Case conversion would create a collision
3. WHEN a collision is detected THEN the System SHALL skip the tag and record it in the skipped list
4. WHEN no collision exists THEN the System SHALL update the tag name to Title Case
5. WHEN the operation completes THEN the System SHALL return counts of updated tags and skipped tags with reasons

### Requirement 5: Title Case Formatting Utility

**User Story:** As a developer, I want a pure function for Title Case conversion, so that formatting logic is testable and reusable.

#### Acceptance Criteria

1. WHEN `toTitleCase` is called with a string THEN the System SHALL capitalize the first letter of each word
2. WHEN the input contains multiple consecutive spaces THEN the System SHALL collapse them to single spaces
3. WHEN the input has leading or trailing whitespace THEN the System SHALL trim the whitespace
4. WHEN the input is empty or whitespace-only THEN the System SHALL return an empty string

</content>
</invoke>