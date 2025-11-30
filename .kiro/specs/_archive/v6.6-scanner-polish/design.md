# Design Document: V6.6 Scanner Polish

## Overview

V6.6 addresses friction points discovered during field testing of the Bulk Import pipeline. The changes are tightly scoped to the PDF scanning and MCQ drafting workflow, without touching Library or Study flows.

**Key Features:**
1. **Context Stitcher** - Handle questions spanning page breaks via "Append Next Page" button and "Include Next Page" checkbox
2. **Vision Priority** - Update AI prompts to prioritize image content when provided
3. **Option E Support** - Add missing "To Option E" button in TextSelectionToolbar
4. **Tag Parity** - Bring single draft tagging to parity with batch drafts
5. **Editable Batch Tags** - Replace read-only tag chips with TagSelector in BatchReviewPanel

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BulkImportPage                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  PDF Controls   │  │ TextSelection   │  │  AI Controls    │  │
│  │  - Page Nav     │  │ Toolbar         │  │  - Mode Toggle  │  │
│  │  - Append Next  │  │ - To Stem       │  │  - Image Drop   │  │
│  │  - Include +1   │  │ - To Option A-E │  │  - Scan Page    │  │
│  └─────────────────┘  │ - To Explanation│  └─────────────────┘  │
│                       └─────────────────┘                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    BulkMCQForm                               ││
│  │  - Stem, Options A-E, Explanation                           ││
│  │  - TagSelector (NEW: AI tags + session tags)                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server Actions                                │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐   │
│  │  draftMCQFromText       │  │  draftBatchMCQFromText      │   │
│  │  - Returns tags[]       │  │  - Vision priority prompt   │   │
│  │  - Vision priority      │  │  - Extract mode validation  │   │
│  └─────────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BatchReviewPanel                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  BatchDraftCard (per draft)                                 ││
│  │  - Stem, Options, Explanation editors                       ││
│  │  - TagSelector (NEW: editable AI + session tags)            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. PDF Text Extraction (Extended)

**File:** `src/lib/pdf-text-extraction.ts`

```typescript
// Existing function - no changes needed
export async function extractCleanPageText(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<string>

// NEW: Combine text from multiple pages with separators
export function combinePageTexts(
  texts: Array<{ pageNumber: number; text: string }>
): string
```

### 2. TextSelectionToolbar (Extended)

**File:** `src/components/cards/TextSelectionToolbar.tsx`

```typescript
// Extended TargetField type
export type TargetField = 
  | 'stem' 
  | 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'optionE'  // NEW: optionE
  | 'explanation'

// Extended field sequence
export const FIELD_SEQUENCE: TargetField[] = [
  'stem', 'optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'explanation'
]
```

### 3. MCQ Draft Schema (Extended)

**File:** `src/lib/mcq-draft-schema.ts`

```typescript
// Extended schema to include optional tags
export const mcqDraftSchema = z.object({
  stem: z.string().min(10),
  options: z.array(z.string().min(1)).min(2).max(5),  // Allow 2-5 options
  correct_index: z.number().int().min(0).max(4),
  explanation: z.string().min(10),
  tags: z.array(z.string()).optional(),  // NEW: AI-generated tags
})
```

### 4. AI Actions (Extended)

**File:** `src/actions/ai-actions.ts`

```typescript
// Updated system prompts with Vision priority
const VISION_PRIORITY_INSTRUCTION = `
IF an image is provided, treat it as primary. The text may just be background.
Prefer questions that clearly come from the image.
If NO question is visible, say so instead of inventing one.`

// Tag generation helper (shared with batch)
function generateTagsInstruction(): string {
  return `tags: Array of 1-3 MEDICAL CONCEPT tags only (e.g., "Preeclampsia", "PelvicAnatomy")
  - Format: Use PascalCase without spaces
  - Do NOT generate structural tags (e.g., Chapter1, Lange)`
}
```

### 5. BatchDraftCard (Extended)

**File:** `src/components/batch/BatchDraftCard.tsx`

```typescript
interface BatchDraftCardProps {
  draft: MCQBatchDraftUI
  index: number
  sessionTagIds: string[]      // NEW: for TagSelector
  sessionTagNames: string[]
  onChange: (updated: MCQBatchDraftUI) => void
}

// Replace read-only tag chips with TagSelector
// Key by draft.id to prevent re-mounting on tag edits
```

### 6. BulkImportPage (Extended)

**File:** `src/app/(app)/decks/[deckId]/add-bulk/page.tsx`

```typescript
// NEW state for Context Stitcher
const [includeNextPage, setIncludeNextPage] = useState(false)
const [isAppending, setIsAppending] = useState(false)

// NEW: Append Next Page handler
const handleAppendNextPage = async (pdfDocument: PDFDocumentProxy, currentPage: number) => {
  // Extract text from currentPage + 1
  // Append with separator to textarea
}

// MODIFIED: Scan Page handler to support +1 mode
const handleScanPage = async (pdfDocument: PDFDocumentProxy, pageNumber: number) => {
  // If includeNextPage, combine both pages
}
```

## Data Models

### MCQDraft (Extended)

```typescript
interface MCQDraft {
  stem: string
  options: string[]           // 2-5 options (was fixed at 5)
  correct_index: number       // 0-4
  explanation: string
  tags?: string[]             // NEW: AI-generated concept tags
}
```

### MCQBatchDraftUI (No changes)

```typescript
interface MCQBatchDraftUI {
  id: string
  stem: string
  options: string[]
  correctIndex: number
  explanation: string
  aiTags: string[]            // Already supports editable tags
  include: boolean
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Page Text Concatenation Format

*For any* two page texts and their page numbers, when combined using `combinePageTexts`, the result SHALL contain the separator `\n\n--- Page X ---\n` where X is the second page number.

**Validates: Requirements 1.2, 2.3**

### Property 2: Last Page Boundary Disables Controls

*For any* PDF document with N pages, when `currentPage` equals N, both the "Append Next Page" button and "Include Next Page" checkbox SHALL be disabled.

**Validates: Requirements 1.4, 2.4**

### Property 3: Two-Page Scan Combines Both Pages

*For any* PDF document and current page P where P < numPages, when "Include Next Page" is checked and Scan Page is triggered, the text passed to the batch draft pipeline SHALL contain content from both page P and page P+1.

**Validates: Requirements 2.2**

### Property 4: Option E Copies to Index 4

*For any* selected text string, when the user clicks "To Option E", the text SHALL be copied to the options array at index 4.

**Validates: Requirements 4.2**

### Property 5: Single Draft Includes Tags

*For any* successful call to `draftMCQFromText`, the returned draft object SHALL include a `tags` array (possibly empty) using the same format as batch drafts.

**Validates: Requirements 7.1**

### Property 6: Tag Deduplication is Case-Insensitive

*For any* set of session tags and AI tags, when merged, the result SHALL contain no case-insensitive duplicates (e.g., "Preeclampsia" and "preeclampsia" should not both appear).

**Validates: Requirements 7.3**

### Property 7: Batch Tag Edits are Persisted

*For any* batch draft where the user modifies the tag list (adding or removing tags), when the batch is saved, the persisted card SHALL have exactly the edited tag list.

**Validates: Requirements 8.2, 8.3, 8.5**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Append Next Page on last page | Button disabled, tooltip shown |
| Include Next Page on last page | Checkbox disabled, tooltip shown |
| Text extraction fails | Show toast error, don't modify textarea |
| No image provided but Vision mode | Fall back to text-only processing |
| AI returns no tags | Use empty array, don't fail |
| Tag creation fails (race condition) | Retry with existing tag lookup |

## Testing Strategy

### Unit Tests

1. **combinePageTexts** - Verify separator format and ordering
2. **getNextField** - Verify optionE is in correct sequence position
3. **mcqDraftSchema** - Verify optional tags field validation
4. **Tag deduplication helper** - Verify case-insensitive comparison

### Property-Based Tests

The testing strategy uses **Vitest** with **fast-check** for property-based testing.

Each property test MUST:
- Run a minimum of 100 iterations
- Be tagged with the format: `**Feature: v6.6-scanner-polish, Property {number}: {property_text}**`
- Reference the correctness property from this design document

**Property Tests to Implement:**

1. **Property 1: Page concatenation format** - Generate random page texts and numbers, verify separator format
2. **Property 2: Last page boundary** - Generate PDFs with various page counts, verify controls disabled on last page
3. **Property 3: Two-page scan** - Generate page content pairs, verify both appear in combined text
4. **Property 4: Option E index** - Generate random text strings, verify copy to index 4
5. **Property 5: Single draft tags** - Generate draft inputs, verify tags array in response
6. **Property 6: Tag deduplication** - Generate tag sets with case variations, verify no duplicates
7. **Property 7: Batch tag persistence** - Generate tag edit sequences, verify final state matches edits

### Integration Tests

1. End-to-end flow: Upload PDF → Append Next Page → AI Draft → Save
2. End-to-end flow: Scan Page with +1 mode → Review → Edit tags → Save batch
3. Vision flow: Add image → AI Draft → Verify image prioritized

