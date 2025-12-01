# Design Document: V7.1 Auto-Scan Loop Stabilization Hotfix

## Overview

This hotfix addresses critical blocking errors in V7.0 Auto-Scan. The core issue is that Auto-Scan fails to save cards because it passes incorrect/undefined IDs to `bulkCreateMCQV2`. The fix ensures Auto-Scan uses the exact same backend path as the working manual "Scan Page" button.

**Core Invariant**: Auto-Scan must call `draftBatchMCQFromText` → `bulkCreateMCQV2` with identical parameters to manual Scan Page.

## Architecture

No architectural changes. This is a wiring fix within existing components:

```
┌─────────────────────────────────────────────────────────────┐
│                    add-bulk/page.tsx                        │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Route Params│───▶│ useAutoScan  │───▶│ bulkCreateV2  │  │
│  │ deckId      │    │ (FIXED)      │    │ (unchanged)   │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│  ┌─────────────┐           │                               │
│  │linkedSource │───────────┘                               │
│  │ .id         │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. useAutoScan Hook (src/hooks/use-auto-scan.ts)

**Current Issue**: The hook receives `deckId` and `sourceId` as options but they may be undefined/empty when Auto-Scan starts.

**Fix**: 
- Add validation that `deckId` and `sourceId` are non-empty before allowing scan start
- Pass `deckId` directly to `bulkCreateMCQV2` as `deckTemplateId` (they are the same in V2 schema)
- Fix `startScan` to use `savedState.currentPage` when resuming (not reset to 1)

**Interface Changes**:
```typescript
interface UseAutoScanOptions {
  pdfDocument: PDFDocumentProxy | null
  deckId: string        // Must be non-empty from route params
  sourceId: string      // Must be non-empty from linkedSource.id
  sessionTagNames: string[]
  aiMode: AIMode
  includeNextPage: boolean
  // ... callbacks unchanged
}

interface UseAutoScanReturn {
  // ... existing state
  canStart: boolean     // NEW: true only when pdfDocument && deckId && sourceId are valid
  // ... existing controls
}
```

### 2. AutoScanResumeBanner (src/components/pdf/AutoScanResumeBanner.tsx)

**Current Issue**: Banner doesn't guide user to re-upload PDF.

**Fix**: Update text to "Last scan stopped at Page X. Please re-select your PDF to resume."

### 3. AutoScanControls (src/components/pdf/AutoScanControls.tsx)

**Current Issue**: Start button enabled even without PDF.

**Fix**: Disable Start button when `!pdfDocument` or `!canStart`.

### 4. PDFViewer Integration (add-bulk/page.tsx)

**Current Issue**: 
- Append Next shows toast but doesn't update textarea state
- +1 Page checkbox not wired to any logic

**Fix**:
- `handleAppendNextPage`: Update `stitchedText` state AND textarea ref value
- Wire `includeNextPage` checkbox to state that's passed to `handleScanPage`
- Update Scan Page button text based on `includeNextPage` state

### 5. processPage Loop Logic (use-auto-scan.ts)

**Current Issue**: Empty pages (0 MCQs) increment consecutiveErrors, causing premature safety stop.

**Fix**:
- 0 MCQs from AI = success (continue, reset consecutiveErrors)
- Actual error (API fail, save fail) = increment consecutiveErrors
- Add offline detection with auto-pause

## Data Models

No schema changes. This hotfix only fixes wiring to existing tables:
- `card_templates` - where MCQs are stored (correct)
- `user_card_progress` - auto-created by `bulkCreateMCQV2` (correct)
- `deck_templates` - looked up by `deckTemplateId` (must match route param)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Auto-Scan ID Consistency
*For any* Auto-Scan invocation, the `deckTemplateId` passed to `bulkCreateMCQV2` SHALL equal the `deckId` from route params.
**Validates: Requirements 1.1, 1.2**

### Property 2: Initialization Validity
*For any* Auto-Scan hook initialization with a linked source, both `deckId` and `sourceId` SHALL be non-empty strings.
**Validates: Requirements 1.2, 1.3**

### Property 3: Resume Page Preservation
*For any* saved state with `currentPage = N`, calling resume SHALL start scanning from page N (not page 1).
**Validates: Requirements 2.1, 2.4**

### Property 4: Start Button Disabled Without PDF
*For any* state where `pdfDocument` is null, the Start Auto-Scan button SHALL be disabled.
**Validates: Requirements 2.3**

### Property 5: Append Updates Textarea State
*For any* Append Next action, the textarea value SHALL contain the appended page text immediately after the action completes.
**Validates: Requirements 3.1**

### Property 6: Include Next Page Combines Text
*For any* scan with `includeNextPage = true` on page N (where N < totalPages), the extracted text SHALL contain content from both page N and page N+1.
**Validates: Requirements 3.2**

### Property 7: Empty Pages Don't Increment Errors
*For any* page that produces 0 MCQs (but no API error), `consecutiveErrors` SHALL remain unchanged and scanning SHALL continue.
**Validates: Requirements 4.1**

### Property 8: Actual Errors Increment Counter
*For any* page that throws an error (API failure, save failure), `consecutiveErrors` SHALL increment by 1.
**Validates: Requirements 4.2**

### Property 9: Safety Stop at Three Errors
*For any* scan where `consecutiveErrors` reaches 3, scanning SHALL stop and `onSafetyStop` SHALL be called.
**Validates: Requirements 4.3**

## Error Handling

| Error Condition | Handling |
|-----------------|----------|
| `deckId` undefined/empty | `canStart = false`, Start button disabled |
| `sourceId` undefined/empty | `canStart = false`, Start button disabled |
| `pdfDocument` null | `canStart = false`, Start button disabled |
| `bulkCreateMCQV2` returns NOT_FOUND | Log detailed error with received ID, increment consecutiveErrors |
| 0 MCQs from AI | Treat as success, continue to next page |
| `navigator.onLine === false` | Auto-pause, show "Connection lost, scan paused" |

## Testing Strategy

### Property-Based Testing

Use **fast-check** (already in project) for property-based tests.

Each property test must:
1. Be annotated with `**Feature: v7.1-auto-scan-hotfix, Property N: <name>**`
2. Run minimum 100 iterations
3. Reference the correctness property from this design document

### Unit Tests

- Test `bulkCreateMCQV2` error message includes received ID
- Test resume banner text includes page number
- Test button text changes with +1 Page checkbox

### Integration Points

- Verify Auto-Scan → `bulkCreateMCQV2` parameter passing matches manual Scan Page
- Verify localStorage state survives PDF reload