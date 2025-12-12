# Design Document: V11.3 Tag Management UX

## Overview

V11.3 enhances the tag management experience by restoring full CRUD capabilities to the Admin Tags page and reintroducing category/color configuration when creating tags from the TagSelector component. The current implementation only allows quick tag creation with hardcoded "Concept" category, limiting user control. This feature adds a TagCreateDialog component that provides full configuration while maintaining the fast "create at top" UX pattern.

## Architecture

The feature follows the existing architecture patterns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  /admin/tags (TagManager)     │  Deck Page (TagSelector)        │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐    │
│  │ 3-Column Layout         │  │  │ Multi-select Dropdown   │    │
│  │ + Add Tag buttons       │  │  │ + Create at Top         │    │
│  │ + Delete controls       │  │  │ + Edit icons on chips   │    │
│  └──────────┬──────────────┘  │  └──────────┬──────────────┘    │
│             │                 │              │                   │
│             └────────┬────────┴──────────────┘                   │
│                      ▼                                           │
│            ┌─────────────────────┐                               │
│            │  TagCreateDialog    │                               │
│            │  (Shared Component) │                               │
│            └─────────┬───────────┘                               │
└──────────────────────┼──────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server Actions                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ tag-actions.ts: createTag, updateTag, deleteTag             ││
│  │ (Existing - no changes needed)                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer                                │
│  tags (id, user_id, name, color, category, created_at)          │
│  card_template_tags (card_template_id, tag_id)                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Component: TagCreateDialog

A modal dialog for creating and editing tags with full configuration options.

```typescript
interface TagCreateDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (tag: Tag) => void
  // Edit mode props
  editTag?: Tag | null
  // Default values for create mode
  defaultCategory?: TagCategory
  defaultName?: string
}
```

**Behavior:**
- Create mode: Empty form with defaults based on context
- Edit mode: Pre-filled with existing tag values
- Category selection updates color automatically (enforced by existing `getCategoryColor`)
- Validates name uniqueness before submission

### Modified Component: TagManager

Add to the existing TagManager component:

1. **Add Tag Button** in each column header
   - Opens TagCreateDialog with that column's category as default
   
2. **Delete Control** on each tag row
   - Trash icon at row end
   - Opens confirmation dialog on click
   - Calls existing `deleteTag` action

3. **Edit Mode Enhancement**
   - Pencil icon opens TagCreateDialog instead of inline edit
   - Provides unified editing experience

```typescript
// New state in TagManager
const [showCreateDialog, setShowCreateDialog] = useState(false)
const [createDialogCategory, setCreateDialogCategory] = useState<TagCategory>('concept')
const [editingTag, setEditingTag] = useState<Tag | null>(null)
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
```

### Modified Component: TagSelector

Update the existing TagSelector component:

1. **Create Option Behavior Change**
   - Instead of immediate creation, opens TagCreateDialog
   - Name pre-filled with typed text
   - Category defaults to "Concept"

2. **Edit Icon on Tag Chips** (optional enhancement)
   - Small edit icon on selected tag badges
   - Opens TagCreateDialog in edit mode

```typescript
// New state in TagSelector
const [showCreateDialog, setShowCreateDialog] = useState(false)
const [pendingTagName, setPendingTagName] = useState('')
const [editingTag, setEditingTag] = useState<Tag | null>(null)
```

### New Component: DeleteTagConfirmDialog

A confirmation dialog for tag deletion.

```typescript
interface DeleteTagConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  tag: Tag | null
  isDeleting: boolean
}
```

## Data Models

No schema changes required. The feature uses existing tables:

**tags table:**
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('source', 'topic', 'concept')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**card_template_tags table:**
```sql
CREATE TABLE card_template_tags (
  card_template_id UUID REFERENCES card_templates(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (card_template_id, tag_id)
);
```

The `ON DELETE CASCADE` on `tag_id` ensures card associations are automatically removed when a tag is deleted.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tag creation places tag in correct category column
*For any* valid tag name and category, when a tag is created, it SHALL appear in the column matching its category (source → Sources column, topic → Topics column, concept → Concepts column).
**Validates: Requirements 1.3, 1.4**

### Property 2: Category change moves tag to correct column
*For any* existing tag and any new category, when the category is changed and saved, the tag SHALL appear in the new category's column and not in the old column.
**Validates: Requirements 2.2**

### Property 3: Tag deletion removes all card associations
*For any* tag with card associations, when the tag is deleted, the count of card_template_tags rows referencing that tag SHALL be zero.
**Validates: Requirements 3.2, 3.3**

### Property 4: Tag deletion removes tag from list
*For any* tag in a category column, when the tag is deleted, it SHALL no longer appear in any category column.
**Validates: Requirements 3.4**

### Property 5: TagSelector create option shows for non-matching queries
*For any* search query that does not exactly match (case-insensitive) any existing tag name, the "Create" option SHALL be displayed.
**Validates: Requirements 4.1**

### Property 6: TagCreateDialog defaults to Concept from TagSelector
*For any* tag creation initiated from TagSelector, the default category SHALL be "concept" and the default color SHALL be "green".
**Validates: Requirements 4.3**

### Property 7: Created tag is auto-selected in TagSelector
*For any* tag created via TagCreateDialog from TagSelector, after successful creation, the tag SHALL be included in the selectedTagIds array.
**Validates: Requirements 4.4**

### Property 8: Tag edits propagate to all views
*For any* tag edit (name, category, or color change), the updated values SHALL be reflected in both TagSelector and Admin Tags views without page refresh.
**Validates: Requirements 5.2, 7.2**

### Property 9: Tags display category indicator
*For any* tag displayed in a dropdown or list, the rendered output SHALL include both the tag's color styling and a category indicator.
**Validates: Requirements 6.1**

### Property 10: Tags are sorted consistently
*For any* list of tags in TagSelector, the tags SHALL be sorted alphabetically by name within each category group.
**Validates: Requirements 6.2**

### Property 11: Bulk tagging preserves existing functionality
*For any* set of card IDs and existing tag IDs, bulk tagging SHALL successfully create card_template_tags associations without errors.
**Validates: Requirements 7.1**

### Property 12: Source tags not auto-created from bulk import
*For any* tag creation triggered during bulk import flows, if the category would be "source", the creation SHALL be rejected or the category SHALL default to "concept".
**Validates: Requirements 7.3**

## Error Handling

| Error Condition | Handling Strategy |
|-----------------|-------------------|
| Duplicate tag name | Show inline error in TagCreateDialog, prevent submission |
| Empty tag name | Disable submit button, show validation message |
| Delete tag with many cards | Show count in confirmation dialog, proceed on confirm |
| Network error during create/update/delete | Show toast error, preserve form state for retry |
| Concurrent edit conflict | Show toast, refresh tag list |

## Testing Strategy

### Property-Based Testing (fast-check)

The project uses **fast-check** for property-based testing as specified in the tech stack.

**Test file:** `src/__tests__/tag-management-v11.3.property.test.ts`

Properties to implement:
1. Category placement property (Property 1)
2. Category change property (Property 2)
3. Deletion cascade property (Property 3)
4. Create option visibility property (Property 5)
5. Default category property (Property 6)
6. Auto-selection property (Property 7)
7. Sort consistency property (Property 10)
8. Source tag restriction property (Property 12)

### Unit Tests

- TagCreateDialog renders correctly in create vs edit mode
- DeleteTagConfirmDialog shows correct tag info and card count
- TagManager Add Tag button opens dialog with correct defaults
- TagSelector create option opens dialog instead of immediate creation

### Integration Tests

- Full flow: Create tag from Admin → appears in TagSelector
- Full flow: Edit tag from TagSelector → reflects in Admin Tags
- Full flow: Delete tag → removed from all card associations
