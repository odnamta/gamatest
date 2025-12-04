# Requirements Document

## Introduction

V9.4 "Visual Hierarchy & Admin Access" addresses two UX improvements in Celline's OBGYN Prep application:

1. **Tag Visual Sorting**: Tags currently display in arbitrary order, making it difficult to quickly scan card metadata. This feature enforces a consistent visual hierarchy (Source → Topic → Concept) across all tag displays, improving scannability and reinforcing the tag taxonomy.

2. **Admin Navigation**: The Tag Manager utility built in V9.2 exists at `/admin/tags` but has no discoverable entry point in the UI. This feature adds a navigation link for authorized users (admins/authors) to access tag management tools.

## Glossary

- **Tag Category**: The 3-tier taxonomy classification: Source (where content came from), Topic (medical subject area), Concept (specific learning point)
- **Visual Hierarchy**: The consistent ordering of UI elements to establish importance and improve scannability
- **Sort Utility**: A pure function that reorders tags by category priority without modifying database records
- **Admin**: A user with elevated privileges to manage system-wide resources like tags
- **Author**: The user who created a deck template and has edit permissions for that deck

## Requirements

### Requirement 1: Tag Display Sorting

**User Story:** As a deck author, I want tags to display in a consistent order (Source → Topic → Concept), so that I can quickly scan card metadata and understand the tag taxonomy at a glance.

#### Acceptance Criteria

1. WHEN tags are rendered in CardListItem THEN the System SHALL sort tags by category in the order: Source first, Topic second, Concept third
2. WHEN tags are rendered in DeckDetails THEN the System SHALL apply the same sorting order as CardListItem
3. WHEN multiple tags exist within the same category THEN the System SHALL maintain alphabetical order within that category
4. WHEN sorting tags THEN the System SHALL perform the sort client-side without modifying database records
5. WHEN a tag has no category assigned THEN the System SHALL display that tag after all categorized tags

### Requirement 2: Tag Sort Utility Function

**User Story:** As a developer, I want a reusable sort utility function, so that tag ordering logic is centralized and consistent across components.

#### Acceptance Criteria

1. WHEN `sortTagsByCategory` is called with an array of tags THEN the System SHALL return a new array sorted by category priority
2. WHEN defining category priority THEN the System SHALL assign: Source = 1 (highest), Topic = 2, Concept = 3 (lowest)
3. WHEN the input array is empty THEN the System SHALL return an empty array without error
4. WHEN the input contains tags with identical categories THEN the System SHALL preserve stable sort order within categories

### Requirement 3: Tag Badge Visual Distinction

**User Story:** As a user, I want Source, Topic, and Concept tags to have distinct colors, so that I can visually differentiate tag types without reading labels.

#### Acceptance Criteria

1. WHEN rendering a Source category tag THEN the System SHALL apply a blue color scheme to the TagBadge
2. WHEN rendering a Topic category tag THEN the System SHALL apply a purple color scheme to the TagBadge
3. WHEN rendering a Concept category tag THEN the System SHALL apply a green color scheme to the TagBadge
4. WHEN rendering the card type indicator (MCQ/Flashcard) THEN the System SHALL use a visually distinct style from tag badges (different shape or border treatment)

### Requirement 4: Admin Tag Manager Navigation

**User Story:** As an admin or deck author, I want a visible navigation link to the Tag Manager, so that I can access tag management tools without manually entering the URL.

#### Acceptance Criteria

1. WHEN an admin user views the sidebar or library section THEN the System SHALL display a "Manage Tags" button
2. WHEN a deck author views their own deck THEN the System SHALL display a "Manage Tags" button
3. WHEN a non-admin subscriber views a deck THEN the System SHALL hide the "Manage Tags" button
4. WHEN the "Manage Tags" button is clicked THEN the System SHALL navigate to `/admin/tags`
5. WHEN rendering the "Manage Tags" button THEN the System SHALL display a Tags icon from Lucide

### Requirement 5: Permission Check for Admin Access

**User Story:** As a system architect, I want admin navigation to be permission-gated, so that unauthorized users cannot discover or access admin functionality.

#### Acceptance Criteria

1. WHEN determining admin access THEN the System SHALL check if the user is the deck author OR has admin role
2. WHEN the user lacks admin permissions THEN the System SHALL not render the "Manage Tags" button
3. WHEN checking permissions THEN the System SHALL use the existing author check pattern (`user.id === deck_template.author_id`)
