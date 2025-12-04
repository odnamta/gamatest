# Design Document: V8.3 Precision Scanning & Stability

## Overview

V8.3 delivers three targeted improvements to the Bulk Import workflow:

1. **Crash Protection**: Wrap the Bulk Import page in an ErrorBoundary and harden PDFViewer and useAutoScan against null/corrupted inputs
2. **Precision Scanning**: Add Start Page and End Page inputs to AutoScanControls, enabling chapter-by-chapter scanning and easy resume
3. **Intra-Deck Deduplication**: Server action to find and remove MCQs with identical stems, keeping the oldest card

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BulkImportPage                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   ErrorBoundary                           │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐ │  │
│  │  │   PDFViewer     │  │     AutoScanControls            │ │  │
│  │  │ (null-safe)     │  │  ┌─────────┐ ┌─────────┐        │ │  │
│  │  │                 │  │  │Start Pg │ │ End Pg  │        │ │  │
│  │  └─────────────────┘  │  └─────────┘ └─────────┘        │ │  │
│  │                       └─────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    useAutoScan Hook                             │
│  - startScan({ startPage, endPage })                            │
│  - Scan loop: startPage → endPage, then auto-stop               │
│  - localStorage: try/catch on JSON.parse                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Deck Details Page                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Actions Dropdown                                           ││
│  │  ├─ Edit Deck                                               ││
│  │  ├─ Delete Deck                                             ││
│  │  └─ Clean Duplicates  ← NEW                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              removeDuplicateCards Server Action                 │
│  1. Query card_templates WHERE deck_template_id = deckId        │
│  2. Group by normalized stem (lowercase, trimmed)               │
│  3. For each group with count > 1:                              │
│     - Keep oldest (min created_at)                              │
│     - Delete rest in transaction                                │
│  4. Return { deletedCount }                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. ErrorBoundary Enhancement

The existing `ErrorBoundary` component at `src/components/ui/ErrorBoundary.tsx` is already suitable. We wrap the Bulk Import page content with it.

```typescript
// In BulkImportPage
<ErrorBoundary fallback={<BulkImportErrorFallback onRetry={handleRetry} />}>
  {/* existing page content */}
</ErrorBoundary>
```

### 2. PDFViewer Null Safety

The PDFViewer already handles `!fileUrl` with a placeholder. We verify this guard is at the top of the render function:

```typescript
// Already exists in PDFViewer.tsx
if (!fileUrl) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <AlertCircle className="w-8 h-8 text-slate-400" />
      <p className="mt-2 text-sm text-slate-600">No PDF file selected</p>
    </div>
  )
}
```

### 3. useAutoScan localStorage Hardening

Update `loadAutoScanState` to catch JSON parse errors:

```typescript
export function loadAutoScanState(
  deckId: string,
  sourceId: string
): AutoScanState | null {
  if (typeof window === 'undefined') return null
  try {
    const key = getStorageKey(deckId, sourceId)
    const stored = localStorage.getItem(key)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    // Validate shape before returning
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as AutoScanState
  } catch (err) {
    // Corrupted JSON - clear it and return null
    console.warn('[useAutoScan] Corrupted localStorage, clearing:', err)
    clearAutoScanState(deckId, sourceId)
    return null
  }
}
```

### 4. AutoScanControls with Page Range Inputs

New props and UI elements:

```typescript
interface AutoScanControlsProps {
  // ... existing props
  startPage: number
  endPage: number
  onStartPageChange: (page: number) => void
  onEndPageChange: (page: number) => void
}
```

UI additions:
- Two number inputs for Start Page and End Page
- Validation: startPage >= 1, endPage <= totalPages, startPage <= endPage
- Disable Start button when validation fails

### 5. useAutoScan Range Support

Update `startScan` signature:

```typescript
interface ScanRange {
  startPage: number
  endPage: number
}

startScan: (range?: ScanRange) => void
```

The scan loop checks `currentPage <= endPage` instead of `currentPage <= totalPages`.

### 6. removeDuplicateCards Server Action

New server action in `src/actions/card-actions.ts`:

```typescript
interface DeduplicationResult {
  ok: boolean
  deletedCount?: number
  error?: string
}

export async function removeDuplicateCards(deckId: string): Promise<DeduplicationResult>
```

Logic:
1. Fetch all card_templates for the deck
2. Normalize stems: `stem.toLowerCase().trim()`
3. Group by normalized stem
4. For groups with count > 1, keep oldest, delete rest
5. Use transaction for safety

## Data Models

No new database tables. Uses existing:

- `card_templates`: Contains `stem`, `deck_template_id`, `created_at`
- `user_card_progress`: May have references to deleted cards (cascade delete via FK)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: localStorage Corruption Recovery

*For any* corrupted or invalid JSON string stored in localStorage for auto-scan state, calling `loadAutoScanState` SHALL return null without throwing an exception, and the corrupted entry SHALL be cleared.

**Validates: Requirements 1.2**

### Property 2: Start Page Synchronization

*For any* page number change in PDFViewer (from 1 to totalPages), the Start Page input in AutoScanControls SHALL update to match the new current page when the user has not manually edited it.

**Validates: Requirements 2.3**

### Property 3: Range-Bounded Scanning

*For any* valid page range [startPage, endPage] where 1 <= startPage <= endPage <= totalPages, the auto-scan loop SHALL process exactly pages startPage through endPage (inclusive) and then stop automatically.

**Validates: Requirements 2.4, 2.5**

### Property 4: Invalid Range Validation

*For any* page range where startPage > endPage OR startPage < 1 OR endPage > totalPages, the AutoScanControls component SHALL disable the Start button and display a validation error.

**Validates: Requirements 2.6**

### Property 5: Deduplication Correctness

*For any* deck containing cards with duplicate normalized stems, after calling `removeDuplicateCards`:
- Each unique normalized stem SHALL have exactly one card remaining
- The surviving card SHALL be the one with the earliest `created_at` timestamp
- The returned `deletedCount` SHALL equal the total number of cards removed

**Validates: Requirements 3.1, 3.2**

## Error Handling

| Scenario | Handling |
|----------|----------|
| PDFViewer receives null fileUrl | Display placeholder UI, keep upload button visible |
| localStorage contains corrupted JSON | Catch parse error, clear corrupted entry, return null |
| Child component throws during render | ErrorBoundary catches, displays retry UI |
| Invalid page range entered | Disable Start button, show validation message |
| Database error during deduplication | Transaction rollback, return error response |
| No duplicates found | Return success with deletedCount: 0 |

## Testing Strategy

### Unit Tests

- PDFViewer renders placeholder when fileUrl is null
- ErrorBoundary catches thrown errors and renders fallback
- AutoScanControls validates page range inputs
- removeDuplicateCards handles empty deck gracefully

### Property-Based Tests

Using **fast-check** for property-based testing:

1. **localStorage Corruption Recovery** (Property 1)
   - Generate arbitrary strings (including invalid JSON)
   - Verify loadAutoScanState never throws and returns null for invalid input

2. **Range-Bounded Scanning** (Property 3)
   - Generate valid ranges within [1, totalPages]
   - Simulate scan loop and verify exactly those pages are processed

3. **Invalid Range Validation** (Property 4)
   - Generate invalid ranges (start > end, out of bounds)
   - Verify validation function returns false

4. **Deduplication Correctness** (Property 5)
   - Generate arrays of cards with some duplicate stems
   - Apply deduplication logic
   - Verify only oldest per stem survives and count is correct

Each property-based test will:
- Run minimum 100 iterations
- Be tagged with the property number and requirements reference
- Use the format: `**Feature: v8.3-precision-scanning, Property {N}: {name}**`
