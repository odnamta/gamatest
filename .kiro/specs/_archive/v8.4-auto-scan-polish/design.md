# Design Document: V8.4 Auto-Scan Polish

## Overview

This design addresses two bugs in the Auto-Scan feature:

1. **Resume Amnesia**: The scan state is not being persisted at the right time, causing resume to fail
2. **Missing Tags**: AI-generated tags are passed through the system but not properly linked in the database

Both issues stem from timing/sequencing problems in the existing code rather than missing functionality.

## Architecture

The Auto-Scan feature spans three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser)                          │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  useAutoScan    │───▶│  auto-scan-storage.ts        │   │
│  │  (orchestrator) │    │  (localStorage persistence)   │   │
│  └────────┬────────┘    └──────────────────────────────┘   │
│           │                                                  │
└───────────┼──────────────────────────────────────────────────┘
            │ Server Action calls
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server (Next.js)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  bulkCreateMCQV2 (batch-mcq-actions.ts)             │   │
│  │  - Creates card_templates                            │   │
│  │  - Upserts tags                                      │   │
│  │  - Links card_template_tags                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (Supabase)                       │
│  ┌──────────────┐  ┌──────┐  ┌────────────────────┐        │
│  │card_templates│  │ tags │  │ card_template_tags │        │
│  └──────────────┘  └──────┘  └────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Fix 1: Resume State Persistence

**File:** `src/hooks/use-auto-scan.ts`

**Current Issue:** 
- `persistState()` is called via useEffect when state changes, but React's batched updates may delay this
- The scan loop advances `currentPage` before the persist effect runs
- If the browser closes or user navigates away, the latest page may not be saved

**Solution:**
- Call `persistState()` synchronously after each successful page process, before advancing
- Ensure `pauseScan()` explicitly calls `persistState()` (already implemented but verify)
- Add explicit persist call in `runScanIteration` after updating stats

**Interface Changes:** None - internal implementation fix

### Fix 2: AI Tag Persistence

**File:** `src/actions/batch-mcq-actions.ts`

**Current Issue:**
- The `bulkCreateMCQV2` function receives `tagNames` in each card
- Tags are being collected and resolved to IDs correctly
- The junction table insertion loop iterates through `cards[i].tagNames`
- **Bug:** Need to verify the tag linking loop is executing correctly

**Analysis of Current Code:**
```typescript
// Step 4: Insert card_template_tags
for (let i = 0; i < insertedTemplates.length; i++) {
  const cardTemplateId = insertedTemplates[i].id
  
  // Session tags - working
  for (const tagName of sessionTags) { ... }
  
  // AI tags - this loop should work but may have issues
  for (const tagName of cards[i].tagNames) {
    const tagId = tagNameToId.get(tagName.trim().toLowerCase())
    if (tagId) { ... }
  }
}
```

**Potential Issues:**
1. `tagNameToId` map uses lowercase keys, but lookup may not be finding matches
2. The `cards[i].tagNames` array may be empty or undefined in some cases
3. Race condition in tag creation may cause lookups to fail

**Solution:**
- Add defensive checks for `cards[i].tagNames` being undefined/empty
- Add logging to trace tag flow: count of tags received, resolved, and linked
- Ensure the map lookup uses consistent casing

## Data Models

No schema changes required. Existing tables:

**tags**
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users)
- `name` (text)
- `color` (text)

**card_template_tags**
- `card_template_id` (uuid, FK)
- `tag_id` (uuid, FK)
- Primary key: (card_template_id, tag_id)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: State persistence before page advance
*For any* successful page processing in Auto-Scan, the localStorage state SHALL contain the incremented currentPage value before the next iteration begins.
**Validates: Requirements 1.1**

### Property 2: Pause triggers immediate persist
*For any* scan state, calling pauseScan SHALL result in localStorage containing the current state with isScanning=false.
**Validates: Requirements 1.2**

### Property 3: Resumable state detection
*For any* valid saved state with isScanning=true, loading that state SHALL set hasResumableState to true.
**Validates: Requirements 1.3**

### Property 4: Resume preserves stats
*For any* saved scan state, calling resume SHALL preserve the stats (cardsCreated, pagesProcessed, errorsCount) from the saved state.
**Validates: Requirements 1.4**

### Property 5: Corruption recovery
*For any* corrupted or invalid JSON in localStorage, loadAutoScanState SHALL return null and clear the corrupted entry.
**Validates: Requirements 1.5**

### Property 6: Tag deduplication across session and AI tags
*For any* card with both sessionTags and AI tagNames, the resulting card_template_tags entries SHALL contain the union of both sets without duplicates (case-insensitive).
**Validates: Requirements 2.4**

### Property 7: Case-insensitive tag reuse
*For any* tag name that differs only in case from an existing user tag, the system SHALL reuse the existing tag ID rather than creating a new tag.
**Validates: Requirements 2.5**

## Error Handling

### localStorage Errors
- Wrap all localStorage operations in try/catch
- Log warnings but don't throw - allow scan to continue
- If save fails, scan continues but resume may not work

### Tag Creation Errors
- Handle unique constraint violations (23505) by re-fetching the existing tag
- Log tag creation failures but continue with other tags
- Don't fail the entire bulk create if some tags fail

### Network Errors During Scan
- Existing retry logic handles transient failures
- After 3 consecutive errors, safety stop triggers
- User can resume from last successful page

## Testing Strategy

### Property-Based Tests (fast-check)

**Test File:** `src/__tests__/auto-scan-resume.property.test.ts`

Tests for Resume State:
1. State persistence timing - verify localStorage updates before page advance
2. Pause persistence - verify pauseScan triggers immediate save
3. Resume stats preservation - verify stats are not reset on resume
4. Corruption recovery - verify invalid JSON is handled gracefully

**Test File:** `src/__tests__/tag-persistence.property.test.ts`

Tests for Tag Persistence:
1. Tag deduplication - verify no duplicate card_template_tags entries
2. Case-insensitive matching - verify "Tag" and "tag" resolve to same ID
3. Session + AI tag merge - verify both sets are persisted

### Unit Tests

- Mock localStorage for state persistence tests
- Mock Supabase client for tag persistence tests
- Verify logging output contains expected fields

### Integration Tests

- End-to-end Auto-Scan with pause/resume
- Verify tags appear in database after bulk create
