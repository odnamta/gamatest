# Implementation Plan

## Phase 1: Database Foundation

- [x] 1. Schema Migration - Add category to tags table
  - [x] 1.1 Create migration script to add category enum and column
    - Add `tag_category` enum type with values 'source', 'topic', 'concept'
    - Add `category` column to `tags` table with default 'concept'
    - Update all existing tags to category 'concept'
    - _Requirements: 1.1, 1.2, 1.6_
  - [x] 1.2 Write property test for default category
    - **Property 2: Default category is concept**
    - **Validates: Requirements 1.2**
  - [x] 1.3 Update TypeScript types for Tag entity
    - Add `TagCategory` type to `src/types/database.ts`
    - Update `Tag` interface to include `category` field
    - _Requirements: 1.1_

- [x] 2. Category-Color Enforcement
  - [x] 2.1 Update tag-colors.ts with category-based color logic
    - Add `CATEGORY_COLORS` constant mapping
    - Create `getCategoryColor(category)` function
    - Update `getTagColorClasses()` to accept category parameter
    - _Requirements: 1.3, 1.4, 1.5_
  - [x] 2.2 Write property test for category-color invariant
    - **Property 1: Category determines color**
    - **Validates: Requirements 1.3, 1.4, 1.5**
  - [x] 2.3 Update tag-actions.ts to enforce category-based colors
    - Modify `createTag()` to accept category parameter
    - Auto-set color based on category
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Golden List Seeding

- [x] 4. Seed Script Implementation
  - [x] 4.1 Create seed-topics.ts script
    - Define official Topics array: Anatomy, Endocrinology, Infections, Oncology, MaternalFetal
    - Define official Sources array: Williams, Lange, MRCOG
    - Implement upsert logic for idempotent seeding
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 4.2 Write property test for seed idempotence
    - **Property 3: Seed script idempotence**
    - **Validates: Requirements 2.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Tag Manager Admin UI

- [x] 6. Admin Tag Actions
  - [x] 6.1 Create admin-tag-actions.ts server actions
    - Implement `updateTagCategory(tagId, newCategory)` - updates category and color atomically
    - Implement `mergeTags(sourceTagId, targetTagId)` - transfers associations and deletes source
    - Implement `getTagsByCategory()` - returns tags grouped by category
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [x] 6.2 Write property test for category change updates color
    - **Property 5: Category change updates color**
    - **Validates: Requirements 3.2**
  - [x] 6.3 Write property test for tag merge preserves associations
    - **Property 6: Tag merge preserves associations**
    - **Validates: Requirements 3.3**

- [x] 7. Tag Manager UI Component
  - [x] 7.1 Create TagManager.tsx component
    - Three-column layout for Sources, Topics, Concepts
    - Category dropdown for each tag to change category
    - _Requirements: 3.1, 3.2_
  - [x] 7.2 Implement tag merge UI
    - Multi-select mode for choosing two tags
    - Merge button with confirmation dialog
    - _Requirements: 3.3_
  - [x] 7.3 Create /admin/tags page
    - Route setup with admin layout
    - Integrate TagManager component
    - _Requirements: 3.1_
  - [x] 7.4 Write property test for tag grouping by category
    - **Property 4: Tag grouping by category**
    - **Validates: Requirements 3.1, 6.1**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Context-Aware AI Tagging

- [x] 9. AI Prompt Enhancement
  - [x] 9.1 Update batch-mcq-actions.ts to fetch Golden List
    - Query topics from database before AI call
    - Pass topic list to system prompt
    - _Requirements: 4.1_
  - [x] 9.2 Update AI system prompt for topic classification
    - Instruct AI to classify into exactly one official Topic
    - Instruct AI to generate 1-2 PascalCase Concept tags
    - _Requirements: 4.2, 4.3_
  - [x] 9.3 Update tag saving logic with category assignment
    - Detect if tag matches Golden List topic → assign 'topic' category
    - Otherwise assign 'concept' category
    - _Requirements: 4.4_
  - [x] 9.4 Write property test for AI topic classification
    - **Property 7: AI topic classification**
    - **Validates: Requirements 4.2**
  - [x] 9.5 Write property test for AI concept format
    - **Property 8: AI concept format**
    - **Validates: Requirements 4.3**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Session Tag Presets

- [x] 11. Session Presets UI
  - [x] 11.1 Create SessionPresets.tsx component
    - Source dropdown filtered to category='source'
    - Topic dropdown filtered to category='topic'
    - _Requirements: 5.1_
  - [x] 11.2 Integrate SessionPresets into BulkImportClient
    - Replace single tag selector with Source/Topic dropdowns
    - Pass selected tags to batch draft action
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 11.3 Update tag merging logic for session tags
    - Merge session tags (Source + Topic) with AI concept tags
    - Preserve category on each tag
    - Case-insensitive deduplication
    - _Requirements: 5.4_
  - [x] 11.4 Write property test for session tag category preservation
    - **Property 9: Session tag category preservation**
    - **Validates: Requirements 5.2, 5.3**
  - [x] 11.5 Write property test for session tag deduplication
    - **Property 10: Session tag deduplication**
    - **Validates: Requirements 5.4**

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Categorized Filtering

- [x] 13. Enhanced FilterBar
  - [x] 13.1 Update FilterBar.tsx with category grouping
    - Group tags by category with section headers
    - Hide empty category sections
    - _Requirements: 6.1, 6.4_
  - [x] 13.2 Update filter pill colors to use category
    - Use `getTagColorClasses(tag.category)` for pill styling
    - _Requirements: 6.2_
  - [x] 13.3 Update filter logic for multi-category selection
    - AND logic within categories, AND logic between categories
    - _Requirements: 6.3_
  - [x] 13.4 Write property test for filter category colors
    - **Property 11: Filter category colors**
    - **Validates: Requirements 6.2**
  - [x] 13.5 Write property test for empty category hiding
    - **Property 12: Empty category hiding**
    - **Validates: Requirements 6.4**

- [x] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
