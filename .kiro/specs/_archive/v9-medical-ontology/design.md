# Design Document: V9 Medical Ontology

## Overview

This design transforms the flat tagging system into a structured 3-Tier Medical Ontology with semantic categories (Source/Topic/Concept). The implementation adds a `category` enum to the tags table, enforces category-based color styling, provides an admin interface for tag management, and enhances AI tagging to leverage the official taxonomy.

## Architecture

```mermaid
graph TB
    subgraph "Data Layer"
        Tags[(tags table<br/>+ category enum)]
        CardTemplateTags[(card_template_tags)]
    end
    
    subgraph "Server Actions"
        TagActions[tag-actions.ts]
        BatchMCQActions[batch-mcq-actions.ts]
        AdminActions[admin-tag-actions.ts]
    end
    
    subgraph "UI Components"
        TagSelector[TagSelector.tsx]
        FilterBar[FilterBar.tsx]
        TagManager[TagManager.tsx]
        SessionPresets[SessionPresets.tsx]
    end
    
    subgraph "Utilities"
        TagColors[tag-colors.ts]
        TagUtils[tag-utils.ts]
    end
    
    Tags --> CardTemplateTags
    TagActions --> Tags
    BatchMCQActions --> Tags
    AdminActions --> Tags
    TagSelector --> TagActions
    FilterBar --> TagColors
    TagManager --> AdminActions
    SessionPresets --> TagActions


## Components and Interfaces

### 1. Database Schema Changes

```sql
-- Add category enum type
CREATE TYPE tag_category AS ENUM ('source', 'topic', 'concept');

-- Add category column to tags table
ALTER TABLE tags ADD COLUMN category tag_category NOT NULL DEFAULT 'concept';

-- Migration: Set all existing tags to 'concept'
UPDATE tags SET category = 'concept' WHERE category IS NULL;
```

### 2. TypeScript Types

```typescript
// src/types/database.ts
export type TagCategory = 'source' | 'topic' | 'concept';

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  category: TagCategory;
  created_at: string;
}

// Category-to-color mapping (enforced)
export const CATEGORY_COLORS: Record<TagCategory, string> = {
  source: 'blue',
  topic: 'purple',
  concept: 'green',
};
```

### 3. Tag Color Enforcement

```typescript
// src/lib/tag-colors.ts
export function getCategoryColor(category: TagCategory): string {
  return CATEGORY_COLORS[category];
}

export function getTagColorClasses(category: TagCategory): { bgClass: string; textClass: string } {
  switch (category) {
    case 'source':
      return { bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-700 dark:text-blue-300' };
    case 'topic':
      return { bgClass: 'bg-purple-100 dark:bg-purple-900/30', textClass: 'text-purple-700 dark:text-purple-300' };
    case 'concept':
    default:
      return { bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300' };
  }
}
```

### 4. Server Actions

#### Tag Creation with Category
```typescript
// src/actions/tag-actions.ts
export async function createTag(
  name: string,
  category: TagCategory = 'concept'
): Promise<TagActionResult> {
  const color = getCategoryColor(category);
  // ... insert with category and enforced color
}
```

#### Category Update
```typescript
// src/actions/admin-tag-actions.ts
export async function updateTagCategory(
  tagId: string,
  newCategory: TagCategory
): Promise<TagActionResult> {
  const newColor = getCategoryColor(newCategory);
  // ... update both category and color atomically
}
```

#### Tag Merge
```typescript
export async function mergeTags(
  sourceTagId: string,
  targetTagId: string
): Promise<TagActionResult> {
  // 1. Update all card_template_tags to point to targetTagId
  // 2. Delete sourceTagId
  // 3. Return success
}
```

### 5. UI Components

#### TagManager (Admin)
- Three-column layout: Sources | Topics | Concepts
- Drag-and-drop or dropdown to change category
- Merge tool: select two tags → merge into one
- Located at `/admin/tags`

#### SessionPresets (Bulk Import)
- Two dropdowns: "Source" and "Topic"
- Filters tags by category for each dropdown
- Selected tags applied to all drafted questions

#### FilterBar (Enhanced)
- Groups tags by category with headers
- Uses category-specific colors for pills
- Hides empty category sections

## Data Models

### Tag Entity (Updated)
```typescript
interface Tag {
  id: string;           // UUID
  user_id: string;      // Owner (or null for system tags)
  name: string;         // Display name
  color: string;        // Enforced by category
  category: TagCategory; // 'source' | 'topic' | 'concept'
  created_at: string;
}
```

### Golden List Tags
System-seeded tags with `user_id = null` (or a system user ID):
- Sources: Williams, Lange, MRCOG
- Topics: Anatomy, Endocrinology, Infections, Oncology, MaternalFetal

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Category determines color
*For any* tag with a category, the tag's color field SHALL match the category's enforced color (source→blue, topic→purple, concept→green).
**Validates: Requirements 1.3, 1.4, 1.5**

### Property 2: Default category is concept
*For any* tag created without an explicit category, the tag's category SHALL be 'concept'.
**Validates: Requirements 1.2**

### Property 3: Seed script idempotence
*For any* number of seed script executions, the count of Golden List tags SHALL remain constant after the first execution.
**Validates: Requirements 2.3**

### Property 4: Tag grouping by category
*For any* set of tags, grouping by category SHALL produce three groups where each tag appears in exactly one group matching its category.
**Validates: Requirements 3.1, 6.1**

### Property 5: Category change updates color
*For any* tag whose category is changed, the tag's color SHALL be updated to match the new category's enforced color.
**Validates: Requirements 3.2**

### Property 6: Tag merge preserves associations
*For any* two tags A and B with card associations, merging A into B SHALL result in all cards previously associated with A being associated with B, and tag A being deleted.
**Validates: Requirements 3.3**

### Property 7: AI topic classification
*For any* AI-generated tag set, exactly one tag SHALL have category 'topic' and be from the Golden List.
**Validates: Requirements 4.2**

### Property 8: AI concept format
*For any* AI-generated concept tag, the tag name SHALL be in PascalCase format (no spaces, each word capitalized).
**Validates: Requirements 4.3**

### Property 9: Session tag category preservation
*For any* session tag selected from Source or Topic dropdown, the tag SHALL be saved with its original category preserved.
**Validates: Requirements 5.2, 5.3**

### Property 10: Session tag deduplication
*For any* combination of session tags and AI-generated tags, the merged result SHALL contain no duplicate tag names (case-insensitive).
**Validates: Requirements 5.4**

### Property 11: Filter category colors
*For any* filter pill displayed, the pill's color classes SHALL match its tag's category color.
**Validates: Requirements 6.2**

### Property 12: Empty category hiding
*For any* filter interface, category sections with zero tags SHALL not be rendered.
**Validates: Requirements 6.4**

## Error Handling

### Database Errors
- Category enum constraint violations: Return validation error with allowed values
- Duplicate tag names: Return "Tag already exists" error
- Foreign key violations on merge: Rollback transaction, return error

### AI Tagging Errors
- No matching topic found: Fall back to closest match or "General" topic
- Invalid PascalCase format: Auto-correct to PascalCase before saving
- Empty tag array: Return at least one concept tag

### UI Errors
- Failed category update: Show toast with error message, revert UI state
- Failed merge: Show toast, preserve both tags
- Empty filter results: Show "No cards match filters" message

## Testing Strategy

### Property-Based Testing (fast-check)

The following properties will be tested using fast-check:

1. **Category-Color Invariant**: Generate random categories, verify color mapping
2. **Default Category**: Generate tags without category, verify default
3. **Idempotent Seeding**: Run seed multiple times, verify tag count
4. **Grouping Correctness**: Generate random tags, verify grouping
5. **Category Change**: Generate category transitions, verify color updates
6. **Merge Associations**: Generate cards with tags, merge, verify associations
7. **PascalCase Format**: Generate concept tags, verify format
8. **Deduplication**: Generate overlapping tag sets, verify no duplicates
9. **Filter Colors**: Generate filter state, verify color classes
10. **Empty Category Hiding**: Generate tag sets with empty categories, verify hiding

### Unit Tests

- Seed script creates expected tags
- Tag creation with explicit category
- Tag update changes category and color
- Merge operation deletes source tag
- Filter grouping logic
- Session preset dropdown filtering

### Integration Tests

- Full bulk import flow with session presets
- Tag manager category change persists to database
- Filter bar reflects database tag categories
