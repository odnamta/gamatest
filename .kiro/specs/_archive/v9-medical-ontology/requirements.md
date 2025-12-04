# Requirements Document

## Introduction

V9: The Librarian transforms the flat tagging system into a structured 3-Tier Medical Ontology (Source/Topic/Concept) to organize content across multiple textbooks. This enables better content organization, smarter AI tagging, and more powerful filtering capabilities for medical exam preparation.

The current tagging system treats all tags equally with user-selected colors. This upgrade introduces semantic categories:
- **Source** (Blue): Textbook/reference origin (e.g., "Williams", "Lange", "MRCOG")
- **Topic** (Purple): Medical chapter/domain (e.g., "Anatomy", "Endocrinology", "Oncology")
- **Concept** (Green): Specific medical concepts (e.g., "Preeclampsia", "GestationalDiabetes")

## Glossary

- **Tag**: A label attached to card templates for organization and filtering
- **Tag Category**: The semantic classification of a tag (source, topic, or concept)
- **Source Tag**: A tag identifying the textbook or reference material origin
- **Topic Tag**: A tag identifying the medical domain or chapter
- **Concept Tag**: A tag identifying a specific medical concept or condition
- **Golden List**: The curated set of official Source and Topic tags seeded by administrators
- **Tag Manager**: Administrative interface for managing tag categories and merging tags
- **AI Tagging**: Automatic tag generation during batch MCQ creation

## Requirements

### Requirement 1: Tag Category Schema

**User Story:** As a system administrator, I want tags to have semantic categories, so that content can be organized hierarchically by source, topic, and concept.

#### Acceptance Criteria

1. WHEN a tag is created THEN the Tag_System SHALL store a category field with value 'source', 'topic', or 'concept'
2. WHEN a tag has no explicit category THEN the Tag_System SHALL default the category to 'concept'
3. WHEN a tag category is 'source' THEN the Tag_System SHALL enforce blue color styling
4. WHEN a tag category is 'topic' THEN the Tag_System SHALL enforce purple color styling
5. WHEN a tag category is 'concept' THEN the Tag_System SHALL enforce green color styling
6. WHEN existing tags are migrated THEN the Tag_System SHALL set all existing tags to category 'concept'

### Requirement 2: Golden List Seeding

**User Story:** As a system administrator, I want to seed official Source and Topic tags, so that users have a consistent taxonomy for organizing medical content.

#### Acceptance Criteria

1. WHEN the seed script runs THEN the Tag_System SHALL create official Topic tags including 'Anatomy', 'Endocrinology', 'Infections', 'Oncology', and 'MaternalFetal'
2. WHEN the seed script runs THEN the Tag_System SHALL create official Source tags including 'Williams', 'Lange', and 'MRCOG'
3. WHEN the seed script runs multiple times THEN the Tag_System SHALL not create duplicate tags (idempotent operation)
4. WHEN a Golden List tag is created THEN the Tag_System SHALL assign the correct category and color automatically

### Requirement 3: Tag Manager Interface

**User Story:** As a system administrator, I want to manage tag categories and merge duplicate tags, so that the taxonomy remains clean and consistent.

#### Acceptance Criteria

1. WHEN an administrator visits the tag manager page THEN the Tag_Manager SHALL display tags in three columns grouped by category (Sources, Topics, Concepts)
2. WHEN an administrator changes a tag's category THEN the Tag_Manager SHALL update the tag's category and color accordingly
3. WHEN an administrator selects two tags to merge THEN the Tag_Manager SHALL combine them into one tag and update all card associations
4. WHEN tags are merged THEN the Tag_Manager SHALL preserve all card-tag relationships by pointing to the surviving tag
5. WHEN a tag category is changed THEN the Tag_Manager SHALL automatically update the tag's color to match the category

### Requirement 4: Context-Aware AI Tagging

**User Story:** As a content creator, I want AI to automatically classify questions into official Topics and generate specific Concept tags, so that new content is properly categorized without manual effort.

#### Acceptance Criteria

1. WHEN batch MCQ drafting begins THEN the AI_Tagger SHALL fetch the current Golden List of Topics from the database
2. WHEN generating tags for a question THEN the AI_Tagger SHALL classify the question into exactly one official Topic from the Golden List
3. WHEN generating tags for a question THEN the AI_Tagger SHALL generate 1-2 specific Concept tags in PascalCase format
4. WHEN saving AI-generated tags THEN the AI_Tagger SHALL assign the correct category to each tag (topic or concept)
5. WHEN a Topic tag does not exist in the Golden List THEN the AI_Tagger SHALL select the closest matching official Topic

### Requirement 5: Session Tag Presets

**User Story:** As a content creator, I want to preset Source and Topic tags for a bulk import session, so that all questions from a specific textbook chapter are consistently tagged.

#### Acceptance Criteria

1. WHEN starting a bulk import session THEN the Session_UI SHALL display separate dropdowns for Source and Topic selection
2. WHEN a Source is selected THEN the Session_UI SHALL apply the source tag with category 'source' to all drafted questions
3. WHEN a Topic is selected THEN the Session_UI SHALL apply the topic tag with category 'topic' to all drafted questions
4. WHEN session tags are applied THEN the Session_UI SHALL merge them with AI-generated concept tags without duplicates

### Requirement 6: Categorized Filtering

**User Story:** As a learner, I want to filter cards by Source, Topic, or Concept, so that I can focus my study on specific textbooks, chapters, or medical conditions.

#### Acceptance Criteria

1. WHEN viewing the filter interface THEN the Filter_UI SHALL group available tags under category headers ('By Source', 'By Topic', 'By Concept')
2. WHEN displaying filter pills THEN the Filter_UI SHALL use category-specific colors (blue for Source, purple for Topic, green for Concept)
3. WHEN multiple category filters are selected THEN the Filter_UI SHALL apply AND logic within categories and AND logic between categories
4. WHEN no tags exist in a category THEN the Filter_UI SHALL hide that category section

