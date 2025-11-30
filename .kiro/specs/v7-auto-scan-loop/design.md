# Design Document

## Overview

V7.0 Auto-Scan Loop implements a client-side orchestrator that automates full-document MCQ extraction. The system processes PDF pages sequentially using existing V6.x extraction and save actions, with localStorage persistence for crash recovery, retry logic for transient failures, and a 3-consecutive-error safety stop.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Bulk Import Page                          │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │  PDFViewer      │  │  useAutoScan Hook                │  │
│  │  (pdfDocument)  │──│  - State management              │  │
│  └─────────────────┘  │  - Loop orchestration            │  │
│                       │  - localStorage persistence      │  │
│  ┌─────────────────┐  └──────────────────────────────────┘  │
│  │ AutoScanControls│         │                              │
│  │ (Start/Pause/   │◄────────┘                              │
│  │  Stop/Progress) │                                        │
│  └─────────────────┘                                        │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ ResumeBanner    │  │  SkippedPagesPanel               │  │
│  │ (crash recovery)│  │  (error log)                     │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server Actions (V6.x)                     │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │ draftBatchMCQFromText│  │ bulkCreateMCQV2            │   │
│  │ (AI extraction)      │  │ (card persistence)         │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### useAutoScan Hook

```typescript
interface AutoScanState {
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: {
    cardsCreated: number
    pagesProcessed: number
    errorsCount: number
  }
  skippedPages: Array<{
    pageNumber: number
    reason: string
  }>
  consecutiveErrors: number
  lastUpdated: number
}

interface UseAutoScanOptions {
  pdfDocument: PDFDocumentProxy | null
  deckId: string
  sourceId: string
  sessionTagNames: string[]
  aiMode: AIMode
  includeNextPage: boolean
  onPageComplete?: (page: number, cardsCreated: number) => void
  onError?: (page: number, error: string) => void
  onComplete?: (stats: AutoScanState['stats']) => void
  onSafetyStop?: () => void
}

interface UseAutoScanReturn {
  // State
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: AutoScanState['stats']
  skippedPages: AutoScanState['skippedPages']
  hasResumableState: boolean
  
  // Controls
  startScan: (startPage?: number) => void
  pauseScan: () => void
  stopScan: () => void
  resetScan: () => void
  
  // Export
  exportLog: () => void
}
```

### AutoScanControls Component

```typescript
interface AutoScanControlsProps {
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: { cardsCreated: number; pagesProcessed: number }
  skippedCount: number
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onViewSkipped: () => void
  disabled?: boolean
}
```

### AutoScanResumeBanner Component

```typescript
interface AutoScanResumeBannerProps {
  savedPage: number
  onResume: () => void
  onReset: () => void
}
```

### SkippedPagesPanel Component

```typescript
interface SkippedPagesPanelProps {
  isOpen: boolean
  onClose: () => void
  skippedPages: Array<{ pageNumber: number; reason: string }>
  onExport: () => void
}
```

## Data Models

### localStorage Schema

Key: `autoscan_state_{deckId}_{sourceId}`

```typescript
interface PersistedAutoScanState {
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: {
    cardsCreated: number
    pagesProcessed: number
    errorsCount: number
  }
  skippedPages: Array<{
    pageNumber: number
    reason: string
  }>
  consecutiveErrors: number
  lastUpdated: number // Unix timestamp
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Start initializes scanning state
*For any* PDF document, calling `startScan()` should set `isScanning` to true and `currentPage` to 1 (or the provided start page).
**Validates: Requirements 1.1**

### Property 2: Page advancement after success
*For any* successfully processed page N where N < totalPages, the `currentPage` should advance to N+1.
**Validates: Requirements 1.3**

### Property 3: Loop termination at document end
*For any* PDF with N pages, when `currentPage` exceeds N, `isScanning` should become false.
**Validates: Requirements 1.4**

### Property 4: Pause preserves state
*For any* scanning state, calling `pauseScan()` should set `isScanning` to false while preserving `currentPage`, `stats`, and `skippedPages`.
**Validates: Requirements 1.5**

### Property 5: Stop preserves statistics
*For any* scanning state, calling `stopScan()` should set `isScanning` to false while retaining all statistics.
**Validates: Requirements 1.6**

### Property 6: Single retry before skip
*For any* page that fails processing, the system should attempt exactly one retry before adding it to `skippedPages`.
**Validates: Requirements 2.1**

### Property 7: Skipped page recording
*For any* page added to `skippedPages`, the entry should contain both `pageNumber` and `reason` fields.
**Validates: Requirements 2.2**

### Property 8: Three-consecutive-error safety stop
*For any* sequence of 3 consecutive page failures, `isScanning` should become false automatically.
**Validates: Requirements 2.3**

### Property 9: State persistence round-trip
*For any* auto-scan state, saving to localStorage and reading back should produce an equivalent state object.
**Validates: Requirements 3.1**

### Property 10: Resume from saved position
*For any* saved state with `currentPage` = N, calling resume should start scanning from page N.
**Validates: Requirements 3.4**

### Property 11: Reset clears all state
*For any* saved state, calling `resetScan()` should clear localStorage and reset state to initial values.
**Validates: Requirements 3.5**

### Property 12: Export produces valid JSON
*For any* skipped pages log, the export function should produce valid JSON containing `skippedPages` array and `stats` object.
**Validates: Requirements 6.3**

### Property 13: Session tags passed to bulk create
*For any* auto-scan card creation, the `bulkCreateMCQV2` call should include the provided `sessionTagNames`.
**Validates: Requirements 7.1**

### Property 14: AI mode passed to draft action
*For any* auto-scan AI call, the `draftBatchMCQFromText` call should include the provided `aiMode` parameter.
**Validates: Requirements 7.2**

### Property 15: Include next page combines text
*For any* page N where `includeNextPage` is true and N < totalPages, the extracted text should combine pages N and N+1.
**Validates: Requirements 7.3**

## Error Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| Text extraction failure | Retry once, then skip with reason "extraction_failed" |
| AI draft failure | Retry once, then skip with reason "ai_error" |
| Bulk create failure | Retry once, then skip with reason "save_failed" |
| Network timeout | Retry once, then skip with reason "timeout" |
| 3 consecutive errors | Safety stop, preserve state, notify user |
| localStorage full | Log warning, continue without persistence |

## Testing Strategy

### Property-Based Testing

Use `fast-check` for property-based tests. Each property test should run minimum 100 iterations.

Tests will be located in `src/__tests__/auto-scan.property.test.ts`.

### Unit Tests

- Test `useAutoScan` hook state transitions
- Test localStorage serialization/deserialization
- Test component rendering based on state

### Integration Tests

- Test full scan flow with mocked server actions
- Test crash recovery flow (save state, reload, resume)
- Test safety stop trigger and recovery
