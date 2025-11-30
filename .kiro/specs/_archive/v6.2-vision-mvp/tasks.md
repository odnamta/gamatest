# V6.2 Tasks – Hyperflow & Versatility

**Phase Goal:** Speed up real-world importing (Hyperflow UX), activate Tag filtering in the UI, and prepare the AI for both Textbook and Q&A modes. Vision support starts as a contained MVP.

---

## Feature 1: Hyperflow Import (The Speed Up)
**Priority:** Highest

### 1.1 Batch Workflow Polish

- [x] **Auto-Close Modal on Save Success**
  - File: `src/components/batch/BatchReviewPanel.tsx`
  - After successful `bulkCreateMCQ` save, auto-close the modal
  - Show success toast: `Saved N cards · Session total: X`
  - Pass session total count via `onSaveSuccess` callback

- [x] **Scroll Preservation**
  - File: `src/app/(app)/decks/[deckId]/add-bulk/page.tsx`
  - Capture current scroll position before opening Batch Review modal
  - Restore scroll position after modal closes
  - Ensure page number persists (already uses `savePdfPage`)

- [x] **Session HUD**
  - File: `src/components/pdf/SessionHUD.tsx` (new)
  - Create small stats bar component showing `Session: X cards created`
  - Position: top-right of PDF viewer area
  - Add 'Reset' control to clear session count
  - Define 'session' as current visit on this PDF (reset on page reload or explicit reset)
  - File: `src/lib/session-hud-storage.ts` (new) - sessionStorage utilities

### 1.2 Selection Tooltip

- [x] **Make Batch Draft Primary**
  - File: `src/components/pdf/SelectionTooltip.tsx`
  - Visually emphasize 'Batch Draft' button (larger, primary color, purple bg)
  - Mobile: ensure large thumb-friendly tap area (min 48px height)
  - Reorder buttons: Batch Draft first (primary), then AI Draft, then To Stem/Explanation

- [x] **Keyboard Shortcut for Batch Draft**
  - File: `src/hooks/use-hotkeys.ts` (existing)
  - Bind `Shift+Cmd+Enter` (Mac) / `Shift+Ctrl+Enter` (Win/Linux)
  - Trigger Batch Draft only if PDF text selection exists
  - No-op if no selection (shows info toast)
  - Already integrated into add-bulk page

### 1.3 Review Modal Upgrades

- [x] **Include/Exclude Toggle per Card**
  - File: `src/components/batch/BatchDraftCard.tsx` (existing)
  - Already has 'Include' checkbox (default: checked/included)
  - Visually mutes excluded cards (opacity-60)
  - `MCQBatchDraftUI` type already tracks `include` state

- [x] **Count Logic for Save Button**
  - File: `src/components/batch/BatchReviewPanel.tsx`
  - `Save Selected (N)` reflects only included cards
  - Count updates reactively when toggling include

- [x] **Disable Save When N = 0**
  - File: `src/components/batch/BatchReviewPanel.tsx`
  - `disabled={selectedCount === 0 || isSaving}`
  - Payload to `bulkCreateMCQ` only includes cards where `include === true`

---

## Feature 2: Tag Filtering (The ROI)
**Priority:** High

### 2.1 Deck Filter UI

- [x] **FilterBar Component Already Exists**
  - File: `src/components/tags/FilterBar.tsx` (existing)
  - Multi-select dropdown for tag filtering
  - Show active tags as removable pills
  - 'Clear all' control to reset

- [x] **Already Integrated into CardList**
  - File: `src/components/cards/CardList.tsx` (existing)
  - FilterBar positioned above card list
  - Computes all unique tags used in deck
  - Multi-select dropdown (sorted alphabetically via TagSelector)

- [x] **Client-Side Filtering Logic**
  - Filter `cards` array in memory when tags selected
  - Rule: card must contain ALL selected tags (logical AND)
  - Updates displayed card count to reflect filtered results

---

## Feature 3: The 'Brain Toggle' (Textbook vs Q&A)
**Priority:** High

### 3.1 Mode Switcher

- [x] **Create Mode Toggle Component**
  - File: `src/components/ai/ModeToggle.tsx` (new)
  - Segmented control: `Extract (Q&A)` | `Generate (Textbook)`
  - Default: Extract mode
  - Compact design for placement near AI Draft entry points

- [x] **Integrate Mode Toggle into UI**
  - Added toggle to add-bulk page near AI Draft entry points
  - File: `src/app/(app)/decks/[deckId]/add-bulk/page.tsx`
  - Pass selected mode to server actions

- [x] **Persist Mode Selection**
  - File: `src/lib/ai-mode-storage.ts` (new)
  - Save last used mode in `localStorage`
  - Restore on page reload
  - Key: `ai-draft-mode` with values `extract` | `generate`

### 3.2 Prompt Engineering

- [x] **Update Server Actions for Mode Parameter**
  - Files: `src/actions/ai-actions.ts`, `src/actions/batch-mcq-actions.ts`
  - Accept `mode: 'extract' | 'generate'` parameter
  - Updated schemas in `src/lib/mcq-draft-schema.ts`, `src/lib/batch-mcq-schema.ts`

- [x] **Extract Mode Prompt (Q&A)**
  - Instruction: "Identify any existing multiple-choice questions already present in the selected text. Extract the question stems and options verbatim (fix obvious OCR spacing only)."
  - "Do NOT create new questions or add options that aren't clearly present in the text."
  - Preserves V6.1 data-integrity rules (units, clinical numbers must match source)

- [x] **Generate Mode Prompt (Textbook)**
  - Instruction: "Read this textbook-like passage. Create ONE new high-yield board-style MCQ that tests a key concept from this passage."
  - "All clinical facts, thresholds, and units used in the question and answer options must come from the passage. Never invent new numbers or units."
  - "Invent plausible distractors (wrong answers), but they must still be conceptually related to the passage and not contradict medical facts in the passage."

- [x] **Preserve V6.1 Data Integrity Rules in Both Modes**
  - Units and clinical numbers must match source text exactly
  - Model must not invent new clinical thresholds, numbers, or units
  - Only use concepts that actually appear in the provided passage

---

## Feature 4: AI Vision MVP
**Priority:** Medium

### 4.1 Image Handling

- [x] **Create Image Drop Zone Component**
  - File: `src/components/ai/ImageDropZone.tsx` (new)
  - Support paste and drag-drop (single image per request for V6.2)
  - Preview thumbnail of uploaded image
  - Clear/remove image control

- [x] **Client-Side Image Processing**
  - File: `src/lib/image-processing.ts` (new)
  - Resize image to max width ~1024px (maintain aspect ratio)
  - Compress/downscale to keep file size reasonable (JPEG 85% quality)
  - Convert to Base64 for small images (<500KB after resize)
  - For larger images: return file for upload to Supabase Storage

- [x] **Supabase Storage Integration for Large Images**
  - File: `src/lib/supabase/image-upload.ts` (new)
  - Upload resized image to Supabase Storage bucket
  - Generate temporary signed URL (1 hour expiry)
  - Delete utility for cleanup

- [x] **Extend Server Actions for Vision**
  - Files: `src/actions/ai-actions.ts`, `src/actions/batch-mcq-actions.ts`
  - Accept optional `imageBase64` OR `imageUrl` parameter
  - Updated input schemas accordingly

- [x] **OpenAI Vision API Integration**
  - Built into `src/actions/ai-actions.ts` and `src/actions/batch-mcq-actions.ts`
  - Use GPT-4o vision capabilities via multimodal content
  - Prefer `image_url` style payload when using Supabase Storage URLs
  - Fallback to text-only path when no image provided

- [x] **Integrate Image Drop Zone into AI Draft UI**
  - Added ImageDropZone to add-bulk page
  - Pass image data through to server actions

---

## Testing & Validation

- [x] **Existing Tests Pass**
  - All 421 tests pass
  - No breaking changes to existing single-card AI Draft or Batch Draft tests

- [ ] **Manual Testing Checklist**
  - [ ] Batch save auto-closes modal and shows correct toast
  - [ ] PDF scroll position preserved after modal close
  - [ ] Session HUD displays and resets correctly
  - [ ] Batch Draft shortcut works on Mac and Windows
  - [ ] Tag filtering shows correct cards (AND logic)
  - [ ] Mode toggle persists across page reloads
  - [ ] Extract mode extracts verbatim questions
  - [ ] Generate mode creates new questions from textbook content
  - [ ] Image paste/drop works and resizes correctly
  - [ ] Large images upload to Supabase Storage
  - [ ] Vision API returns valid MCQs from images

---

## V6.1 Invariants Preserved

1. ✅ **Units and clinical numbers must match source text exactly** – no conversions, no rounding
2. ✅ **Tags remain user-scoped with case-insensitive uniqueness** – atomic upsert with ILIKE matching
3. ✅ **AI-generated concept tags use purple color** – maintain visual distinction
4. ✅ **Session tags merge with per-card AI tags** – server-side deduplication

---

## File Summary

### New Files Created
- `src/components/pdf/SessionHUD.tsx`
- `src/lib/session-hud-storage.ts`
- `src/components/ai/ModeToggle.tsx`
- `src/lib/ai-mode-storage.ts`
- `src/components/ai/ImageDropZone.tsx`
- `src/lib/image-processing.ts`
- `src/lib/supabase/image-upload.ts`

### Modified Files
- `src/components/batch/BatchReviewPanel.tsx` - auto-close, session total toast
- `src/components/pdf/SelectionTooltip.tsx` - Batch Draft primary button
- `src/actions/ai-actions.ts` - mode support, vision support, new prompts
- `src/actions/batch-mcq-actions.ts` - mode support, vision support, new prompts
- `src/lib/mcq-draft-schema.ts` - AIMode type, imageBase64/imageUrl fields
- `src/lib/batch-mcq-schema.ts` - AIMode type, imageBase64/imageUrl fields
- `src/app/(app)/decks/[deckId]/add-bulk/page.tsx` - full V6.2 integration

### Already Existing (No Changes Needed)
- `src/components/tags/FilterBar.tsx` - tag filtering already implemented
- `src/components/cards/CardList.tsx` - tag filtering already integrated
- `src/hooks/use-hotkeys.ts` - hotkey support already exists
- `src/components/batch/BatchDraftCard.tsx` - include/exclude already implemented
