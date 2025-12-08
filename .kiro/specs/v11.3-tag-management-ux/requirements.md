# Requirements Document

## Introduction

V11.3 Tag Management UX restores full administrative control over tags from the `/admin/tags` page and reintroduces category/color selection when creating tags from the TagSelector component. This addresses the current limitation where quick tag creation only produces green Concept tags without configuration options, while maintaining the fast "create at top" UX pattern.

## Glossary

- **Tag**: A metadata label applied to card templates for organization and filtering. Has name, category, and color properties.
- **Category**: One of three tag classifications: Source (blue, for textbooks/references), Topic (purple, for subject areas), Concept (green, for specific learning points).
- **TagSelector**: The dropdown component used on deck pages for filtering and bulk tagging cards.
- **TagCreateDialog**: A modal/inline dialog for creating or editing tags with full configuration options.
- **Admin Tags Page**: The `/admin/tags` route displaying tags in a 3-column layout (Sources / Topics / Concepts).
- **card_template_tags**: The join table linking tags to card templates.

## Requirements

### Requirement 1

**User Story:** As an admin, I want to create new tags directly from the Admin Tags page, so that I can add tags with proper category and color configuration without using workarounds.

#### Acceptance Criteria

1. WHEN an admin clicks an "Add Tag" button in a column header on the Admin Tags page THEN the System SHALL display a TagCreateDialog with name, category, and color fields
2. WHEN an admin submits a valid tag creation form THEN the System SHALL create the tag using the existing tag creation server action and refresh the tag list
3. WHEN a new tag is created THEN the System SHALL display the tag in the correct category column immediately without requiring a page refresh
4. WHEN the TagCreateDialog opens from a specific column THEN the System SHALL pre-select that column's category as the default

### Requirement 2

**User Story:** As an admin, I want to edit existing tags from the Admin Tags page, so that I can change a tag's name, category, or color in one unified interface.

#### Acceptance Criteria

1. WHEN an admin clicks the edit icon on a tag row THEN the System SHALL open the TagCreateDialog in edit mode with current values pre-filled
2. WHEN an admin changes a tag's category THEN the System SHALL move the tag to the appropriate column after saving
3. WHEN an admin saves tag edits THEN the System SHALL update the tag using the existing tag update server action

### Requirement 3

**User Story:** As an admin, I want to delete tags from the Admin Tags page, so that I can remove obsolete or incorrect tags from the system.

#### Acceptance Criteria

1. WHEN an admin clicks a delete control on a tag row THEN the System SHALL display a confirmation dialog explaining the deletion impact
2. WHEN an admin confirms tag deletion THEN the System SHALL remove all card_template_tags join rows referencing that tag
3. WHEN an admin confirms tag deletion THEN the System SHALL delete the tag row from the database
4. WHEN a tag is deleted THEN the System SHALL refresh the tag list in the affected column immediately
5. IF a tag is marked as locked or system-protected THEN the System SHALL disable the delete control for that tag

### Requirement 4

**User Story:** As a user, I want to create tags with full configuration from the TagSelector dropdown, so that I can quickly add properly categorized tags while filtering or bulk tagging.

#### Acceptance Criteria

1. WHEN a user types in the TagSelector and no exact match exists THEN the System SHALL display a "Create [typed text] tag" option pinned at the top of the dropdown
2. WHEN a user clicks the "Create [typed text] tag" option THEN the System SHALL open a TagCreateDialog with the name pre-filled
3. WHEN the TagCreateDialog opens from TagSelector THEN the System SHALL default the category to "Concept" and color to green
4. WHEN a user submits the TagCreateDialog from TagSelector THEN the System SHALL create the tag and automatically select it in the current TagSelector

### Requirement 5

**User Story:** As a user, I want to edit tags from the TagSelector, so that I can correct tag properties without navigating to the Admin Tags page.

#### Acceptance Criteria

1. WHEN a user clicks an edit icon on a tag chip in TagSelector THEN the System SHALL open the TagCreateDialog in edit mode
2. WHEN a user saves tag edits from TagSelector THEN the System SHALL update the tag and reflect changes across all views

### Requirement 6

**User Story:** As a user, I want visual differentiation between tag categories, so that I can quickly identify Sources, Topics, and Concepts at a glance.

#### Acceptance Criteria

1. WHEN tags are displayed in dropdowns or lists THEN the System SHALL show both the tag color and a category indicator
2. WHEN tags are listed in TagSelector THEN the System SHALL sort tags consistently by category or alphabetically within categories

### Requirement 7

**User Story:** As a system maintainer, I want existing tag functionality to remain stable, so that bulk tagging and tag management features continue working correctly.

#### Acceptance Criteria

1. WHEN bulk tagging is performed with existing tags THEN the System SHALL apply tags to selected cards without errors
2. WHEN a tag is created from the Admin Tags page THEN the System SHALL make it immediately available in all TagSelector instances
3. WHEN tags are created from Bulk Import flows THEN the System SHALL NOT auto-create new Source tags; book_sources remains the source-of-truth for textbooks
4. WHEN the Admin Tags page loads with zero tags in a column THEN the System SHALL display the Add Tag button and a hint message instead of a blank area
