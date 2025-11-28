# Design Document: V3.1 Bugfix & UX Polish

## Overview

This design covers six UX improvements for the Cellines OB/GYN Prep application:

1. **Heatmap Responsive Fix** - Replace horizontal scrolling with a responsive grid that adapts to viewport size
2. **Hide Ghost Features** - Conditionally hide the incomplete Courses section when empty
3. **Deck UI Cleanup** - Remove floating button, simplify inline form
4. **Persistent PDF Upload** - Always-visible Source Bar with change option
5. **Power User Copy Tools** - Multi-target text selection buttons
6. **Dynamic MCQ Options** - Flexible A-E+ option array with add/remove

## Architecture

The changes are localized to existing components with no new architectural patterns required:

```
src/components/
├── dashboard/
│   ├── StudyHeatmap.tsx      # Responsive grid refactor
│   └── LibrarySection.tsx    # Conditional courses section
├── decks/
│   └── CreateDeckForm.tsx    # Simplified form
├── cards/
│   ├── BulkImportStepper.tsx # Source Bar component
│   ├── TextSelectionToolbar.tsx # NEW: Multi-button toolbar
│   └── CreateMCQForm.tsx     # Dynamic options, shared component
└── app/(app)/decks/[deckId]/add-bulk/page.tsx # Integration
```

## Components and Interfaces

### 1. StudyHeatmap (Refactored)

```typescript
interface StudyHeatmapProps {
  studyLogs: Array<{
    study_date: string
    cards_reviewed: number
  }>
}

// Internal hook for responsive day count
function useResponsiveDayCount(): number {
  // Returns 28 for small screens, 60 for large screens
}

// Pure function for generating day array (testable)
function generateDayArray(dayCount: number, logMap: Map<string, number>): DayData[]
```

**Key Changes:**
- Remove `overflow-x-auto` and `min-w-max` classes
- Use CSS Grid with `auto-fill` or fixed columns based on breakpoint
- Use `useMediaQuery` or Tailwind responsive classes for day count

### 2. LibrarySection (Refactored)

```typescript
interface LibrarySectionProps {
  courses: CourseWithProgress[]
  decks: DeckWithDueCount[]
  defaultExpanded?: boolean
}
```

**Key Changes:**
- Wrap entire Courses subsection in `{courses.length > 0 && (...)}`
- Remove CreateCourseForm import and usage
- Update header count to only show decks when courses hidden

### 3. CreateDeckForm (Simplified)

```typescript
// No interface changes, only UI simplification
```

**Key Changes:**
- Remove label prop from Input (or set to empty)
- Change placeholder to "Enter new deck title..."
- Change button text to "Create Deck"

### 4. SourceBar (New Sub-component)

```typescript
interface SourceBarProps {
  fileName: string
  fileUrl?: string
  onChangeClick: () => void
}
```

**Renders:**
- File icon (FileText from lucide-react)
- Filename in green text
- "Change/Replace PDF" secondary button

### 5. TextSelectionToolbar (New Component)

```typescript
interface TextSelectionToolbarProps {
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>
  onCopyToField: (field: TargetField, text: string) => void
  onNoSelection: () => void
}

type TargetField = 'stem' | 'optionA' | 'optionB' | 'optionC' | 'explanation'

// Field sequence for auto-focus
const FIELD_SEQUENCE: TargetField[] = ['stem', 'optionA', 'optionB', 'optionC', 'explanation']

// Pure function for getting next field (testable)
function getNextField(currentField: TargetField): TargetField | null
```

**Buttons:**
- `[To Stem]` - copies to stem field
- `[To Option A]` `[To Option B]` `[To Option C]` - copies to respective option
- `[To Explanation]` - copies to explanation field

### 6. CreateMCQForm (Enhanced)

```typescript
interface CreateMCQFormProps {
  deckId: string
  initialStem?: string
  initialOptions?: string[]
  initialExplanation?: string
  onSuccess?: () => void
}

// Pure functions for option management (testable)
function addOption(options: string[]): string[]
function removeOption(options: string[], index: number): string[]
function getOptionLabel(index: number): string  // 0 -> 'A', 1 -> 'B', etc.
function relabelOptions(options: string[]): string[]  // Ensures sequential labels
```

**Key Changes:**
- Accept initial values as props for Bulk Import integration
- Dynamic option array with add/remove buttons
- Option labels as letters (A, B, C, D, E, F...)
- Min 2 options, max 6 options (configurable)

## Data Models

No database changes required. All changes are UI-only.

### State Models

```typescript
// Heatmap responsive state
interface HeatmapState {
  dayCount: 28 | 60
  days: DayData[]
}

interface DayData {
  date: string      // ISO date string
  count: number     // cards reviewed
  intensity: 0 | 1 | 2 | 3
}

// MCQ Form state
interface MCQFormState {
  stem: string
  options: string[]           // Dynamic array
  correctIndex: number
  explanation: string
  imageUrl?: string
}

// Bulk Import page state
interface BulkImportState {
  linkedSource: {
    id: string
    fileName: string
    fileUrl: string
  } | null
  pastedText: string
  mcqForm: MCQFormState
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Heatmap Day Count by Viewport

*For any* viewport width, the heatmap SHALL display exactly 28 days when width is below the large breakpoint (1024px), and exactly 60 days when width is at or above the large breakpoint.

**Validates: Requirements 1.1, 1.2**

### Property 2: Heatmap Day Ordering

*For any* array of study days generated by the heatmap, the days SHALL be ordered chronologically from oldest to newest, such that for all indices i < j, days[i].date < days[j].date.

**Validates: Requirements 1.4**

### Property 3: Text Selection Transfer

*For any* text selection in the source textarea (where selectionStart < selectionEnd), clicking a copy-to-field button SHALL transfer exactly the substring from selectionStart to selectionEnd into the corresponding target field.

**Validates: Requirements 5.2**

### Property 4: Focus Sequencing After Paste

*For any* target field in the sequence [stem, optionA, optionB, optionC, explanation], after pasting text into that field, focus SHALL move to the next field in the sequence (or remain on explanation if already at the end).

**Validates: Requirements 5.3**

### Property 5: Option Array Labeling Invariant

*For any* sequence of add and remove operations on the options array, the resulting options SHALL always be labeled sequentially as A, B, C, D, E, F... corresponding to indices 0, 1, 2, 3, 4, 5... with no gaps or duplicates.

**Validates: Requirements 6.2, 6.3**

## Error Handling

| Scenario | Handling |
|----------|----------|
| No text selected when copy button clicked | Show toast: "Select text in the left box first." |
| Attempt to remove option when at minimum (2) | Hide remove button when options.length <= 2 |
| Attempt to add option when at maximum (6) | Hide add button when options.length >= 6 |
| PDF upload fails | Show error toast, keep dropzone visible |
| MCQ submission fails | Show inline error, preserve form state |

## Testing Strategy

### Property-Based Testing

The project uses **Vitest** with **fast-check** for property-based testing, as established in the existing test suite.

Each correctness property will be implemented as a property-based test:
- Tests will run a minimum of 100 iterations
- Each test will be tagged with the format: `**Feature: v3.1-bugfix-ux-polish, Property {number}: {property_text}**`
- Generators will be created for:
  - Viewport widths (arbitrary integers in realistic range)
  - Date arrays (arbitrary dates within reasonable bounds)
  - Text selections (arbitrary strings with valid start/end indices)
  - Option arrays (arbitrary string arrays of length 2-6)

### Unit Tests

Unit tests will cover:
- Component rendering with various prop combinations
- Conditional rendering logic (courses hidden when empty)
- Button click handlers
- Form submission flows

### Test File Structure

```
src/__tests__/
├── heatmap-responsive.property.test.ts    # Properties 1, 2
├── text-selection-toolbar.property.test.ts # Properties 3, 4
└── mcq-options.property.test.ts           # Property 5 (extend existing)
```
