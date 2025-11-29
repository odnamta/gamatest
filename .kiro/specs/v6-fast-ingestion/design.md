# V6 – Fast Ingestion & Batching
_Design Spec_

## 1. Architecture Overview

V6 adds a **batch ingestion layer** on top of the existing bulk-import page:

- **Client**:
  - PDF Viewer with selection tooltip (already exists).
  - Single-card MCQ form (already exists).
  - New BatchReviewPanel modal.
  - Session Tag selector.
  - Hotkeys hook.

- **Server**:
  - `draftBatchMCQFromText` – multi-card AI generator.
  - `bulkCreateMCQ` – atomic multi-insert for cards.
  - Uses existing tags & card creation primitives under the hood.

Everything reuses the existing card schema and SM-2 scheduling defaults.

---

## 2. Data Models

### 2.1 Types (client/shared)

```ts
// Existing from V5:
type TagId = string;

interface MCQDraft {
  stem: string;
  options: string[]; // 2–5
  correctIndex: number; // 0–4
  explanation?: string;
}

// New for V6:
interface MCQBatchDraft extends MCQDraft {
  tags?: string[];        // tag names suggested by AI
  sessionTags?: TagId[];  // applied later based on selector
  include: boolean;       // UI checkbox
}
```

### 2.2 Server IO Shapes

```ts
// draftBatchMCQFromText input
type DraftBatchInput = {
  deckId: string;
  text: string;
  defaultTags?: string[]; // tag names from session selector
};

// Output
type DraftBatchResult =
  | { ok: true; drafts: MCQBatchDraft[] }
  | { ok: false; error: { message: string; code?: string } };

// bulkCreateMCQ input
type BulkCreateInput = {
  deckId: string;
  cards: {
    stem: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    tagNames: string[]; // merged session + AI tags
  }[];
};

// Output
type BulkCreateResult =
  | { ok: true; createdCount: number; deckId: string }
  | { ok: false; error: { message: string; code?: string } };
```

---

## 3. Server Actions

### 3.1 draftBatchMCQFromText

**Location:** `src/actions/batch-mcq-actions.ts`

**Responsibilities:**
1. Validate input with Zod (text non-empty, length limit).
2. Build OpenAI prompt:
   - Explain context: OBGYN exam MCQs.
   - Ask for up to 5 distinct MCQs.
   - Ask for 1–3 short topic tags for each MCQ.
   - Require JSON object output with `questions` array.
3. Call OpenAI with JSON mode / `response_format: { type: "json_object" }`.
4. Parse with Zod into `MCQBatchDraft[]`.
5. Map to `{ ok: true, drafts }` or `{ ok: false, error }`.

### 3.2 bulkCreateMCQ

**Location:** `src/actions/batch-mcq-actions.ts`

**Responsibilities:**
1. Validate deck ownership (user can only add to their own decks).
2. Normalize & upsert tags:
   - For each `tagNames` array, resolve names to `tag_id`s.
   - Reuse existing tag creation helpers where possible.
3. Insert all cards in a single Supabase call or transaction:
   - Each card row: stem, options, correctIndex, explanation, SM-2 defaults, deck_id.
   - Join-table inserts for tags.
4. On any failure:
   - Roll back insertions (no partial card creation).
5. Return `createdCount`.

---

## 4. Client Components & Flows

### 4.1 Bulk Import Page Layout (Update)

**Existing Sections:**
- PDF Viewer (left).
- MCQ form + "AI Draft" button (right).
- AI selection tooltip (To Stem / To Explanation / AI Draft).

**New Elements:**
- **Session Tag Selector:**
  - Placed near the top of the page (under breadcrumbs / title).
  - Uses `<TagSelector>` component with hint text: "Applied to all cards from this session."
  - On change: update `sessionTags` state and localStorage.
- **AI Batch Draft Button:**
  - Placed next to existing "AI Draft" button.
  - Secondary styling.
  - Disabled when no selection text is available.

### 4.2 Batch Review Panel

**Component:** `BatchReviewPanel.tsx`

**Props:**
```ts
interface BatchReviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: MCQBatchDraft[];
  onDraftsChange: (drafts: MCQBatchDraft[]) => void;
  sessionTagIds: TagId[];
  sessionTagNames: string[];
  deckId: string;
  onSaveSuccess: (count: number) => void;
}
```

**Behavior:**
- When `isOpen` is true:
  - Desktop: slides in from the right or modal centered.
  - Mobile: full-screen overlay.
- For each draft:
  - Compact version of CreateMCQForm:
    - Stem textarea.
    - 2–5 option inputs.
    - Single-choice radio for correct answer.
    - Explanation textarea.
  - Tags row:
    - Session Tags (pill style, not editable here).
    - AI Tags (removable chips).
  - Include checkbox.
- Footer:
  - Left: count summary ("3 selected out of 5").
  - Right: "Cancel" + "Save selected (3)".

### 4.3 Tag Merge Flow

At save time:
1. For each draft with `include === true`:
   - Start with Session Tags (IDs).
   - Add AI Tag names (strings).
   - Normalize AI tag names:
     - Trim, lower-case, dedupe.
2. Pass merged `tagNames` to `bulkCreateMCQ`.
3. Server resolves names to tag IDs (existing + new).

### 4.4 Hotkeys Design

**Hook:** `useHotkeys` in `src/hooks/use-hotkeys.ts`

- Attach keydown listener at window level.
- Ignore key events if:
  - Event target is inside an element with `data-no-hotkeys` OR
  - A different modal/dialog takes precedence.

**Mappings (Bulk Import page):**
- **Cmd/Ctrl + Enter:**
  - If Batch panel is open: no-op.
  - Else: trigger single-card `handleSubmit()` if form valid.
- **Shift + Cmd/Ctrl + Enter:**
  - If Batch panel open: no-op.
  - Else: check selection text; if non-empty, call batch AI.
- **Esc:**
  - If Batch panel open: `onClose()`.
  - Else: clear PDF selection tooltip.

---

## 5. UX Notes

- **Batch AI is more powerful but slower:**
  - Show a clear loading indicator on the Batch button.
  - Optionally show subtle "AI is thinking…" message.
- **Encourage usage via micro-copy:**
  - Tooltip on Batch button: "Highlight multiple questions and generate up to 5 MCQs at once."
- **Keep escape hatches:**
  - Single-card AI Draft stays visible and unchanged.
  - User can always manually input / edit content.

---

## 6. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Button disabled state matches selection state
*For any* selection state (empty or non-empty), the "AI Batch Draft" button's disabled attribute should equal the negation of whether text is selected.
**Validates: R1.1**

### Property 2: Loading state prevents duplicate submissions
*For any* batch AI action in progress, the "AI Batch Draft" button should be disabled and subsequent clicks should not trigger additional API calls.
**Validates: R1.1, NFR-1**

### Property 3: Batch output size is bounded 0-5
*For any* valid text input to `draftBatchMCQFromText`, the returned drafts array length should be between 0 and 5 inclusive.
**Validates: R1.2**

### Property 4: Batch draft schema validation
*For any* MCQ draft returned by the batch action, it should contain: a stem of at least 10 characters, 2-5 non-empty options, a correctIndex between 0 and 4, and optionally 1-3 topic tags.
**Validates: R1.2**

### Property 5: Batch output capped at 5
*For any* AI response containing more than 5 MCQs, the processed output should contain exactly 5 items (the first 5).
**Validates: R1.2**

### Property 6: Invalid AI response returns typed error
*For any* AI response that fails Zod validation, the action should return `{ ok: false, error: { message, code } }` and not throw an exception.
**Validates: R1.2, NFR-2**

### Property 7: Draft include defaults to true
*For any* MCQ draft transformed to UI format, the `include` property should default to `true`.
**Validates: R1.3**

### Property 8: Unchecked drafts excluded from save payload
*For any* set of drafts where some have `include: false`, the save payload should contain only drafts where `include: true`.
**Validates: R1.3, R1.4**

### Property 9: Tag merge produces unique normalized tags
*For any* combination of session tags and AI tags, the merged result should contain no duplicate tag names (case-insensitive, trimmed).
**Validates: R1.5, R2.3**

### Property 10: Save button disabled when no drafts selected
*For any* state where all drafts have `include: false`, the "Save selected" button should be disabled.
**Validates: R1.4**

### Property 11: Atomic bulk save - all or nothing
*For any* bulk create operation, either all cards are created successfully or zero cards are created (no partial state).
**Validates: R1.4, NFR-2**

### Property 12: Failed bulk save creates zero cards
*For any* bulk create operation that fails, the database should contain zero new cards from that operation.
**Validates: R1.4**

### Property 13: Session tags applied to all saved cards
*For any* card created via single-card form, single-card AI draft, or batch save, if session tags are set, those tags should be associated with the created card.
**Validates: R2.2**

### Property 14: New AI tags created for user
*For any* AI-suggested tag name that doesn't exist for the user, a new tag record should be created with that user as owner.
**Validates: R1.5**

### Property 15: Tag RLS ownership respected
*For any* tag operation, tags should only be accessible by their owning user.
**Validates: R1.5**

### Property 16: Session tags localStorage round-trip
*For any* session tag selection, storing to localStorage and then reading back should produce the same tag IDs.
**Validates: R2.1**

### Property 17: Empty session tags not applied
*For any* card creation when session tags array is empty, no session tags should be associated with the created card.
**Validates: R2.2**

### Property 18: No duplicate tags on merged cards
*For any* card with both session tags and per-card tags, the final tag list should contain no duplicate tag IDs.
**Validates: R2.3**

### Property 19: Shortcuts blocked in unrelated inputs
*For any* keypress event where the target is an input/textarea not part of the MCQ form, shortcuts (except form submission) should not trigger.
**Validates: R3.2**

### Property 20: Zod validation before display
*For any* AI response, it should be validated with Zod before being displayed to the user or used in UI state.
**Validates: NFR-2**

---

## 7. Testing Strategy (High-Level)

**Property-Based Testing:**
- Library: fast-check (already in devDependencies)
- Configuration: Each property test runs a minimum of 100 iterations
- Annotation: Each test includes `**Feature: v6-fast-ingestion, Property N: description**`

**Unit tests:**
- Zod schemas for `MCQBatchDraft`.
- Tag merging logic (session + AI tags).

**Integration tests:**
- Batch flow: selection → Batch Draft → Edit → Save → cards exist in DB.
- Failure path: OpenAI returns malformed JSON → user sees error, no crash.
- Bulk create: simulate DB error → 0 cards created.

**Manual QA checklist:**
- Desktop + mobile layout.
- Interaction with existing Tag filters on Deck page.
- Keyboard shortcuts behavior in different focus states.
