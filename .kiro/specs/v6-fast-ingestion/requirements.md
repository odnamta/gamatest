# V6 – Fast Ingestion & Batching
_Celline's OBGYN Prep – Requirements_

## Goal

Make it 5–10x faster to turn PDF questions into spaced-repetition cards by adding:

1. **Batch AI Draft** – generate multiple MCQs from one text selection.
2. **Session Tag Presets** – sticky context so all new cards share the same tags.
3. **Power-User Shortcuts** – keep hands mostly on keyboard.

V6 is **additive**: it must not break the existing single-card creation flow.

---

## Feature Set 1 – Batch AI Draft (The Speed Engine)

### R1.1 – Batch AI Draft Entry Point

- There is an **"AI Batch Draft"** button on the Bulk Import page, next to the existing **"AI Draft"** button.
- The button is enabled only when:
  - The user has a non-empty text selection in the PDF viewer **OR**
  - The "PDF Text Reference" textarea (if present) has non-empty content.
- On click, the app:
  - Shows a loading state.
  - Calls a **batch AI server action** without blocking the rest of the UI.

### R1.2 – Multi-Question Output

- The batch AI action can return **0–5 MCQ drafts** in a single response.
- Each draft contains:
  - Question stem
  - 2–5 answer options (A–E)
  - Correct answer index
  - Optional explanation
  - Optional list of tag suggestions (topic labels, not book names)
- If no valid MCQs are found, the user sees a friendly message instead of an error.

### R1.3 – Batch Review Panel

- When drafts are returned, a **Batch Review Panel** opens (modal or side drawer).
- The panel shows **one row per MCQ draft**, with:
  - Editable fields for stem, options, correct choice, and explanation.
  - A checkbox to **Include/Exclude** each draft from saving (default: included).
  - A read-only view of tags:
    - **Session Tags** (from Feature Set 2) and
    - **AI Tags** for that draft, merged and de-duplicated.
- The user can:
  - Edit text freely.
  - Remove drafts from the batch via the checkbox.
  - Close the panel with **Esc** or a close button, without losing unsaved edits.

### R1.4 – Atomic Bulk Save

- The panel has a primary button: **"Save selected (N)"**.
  - Disabled when N = 0.
- On click:
  - The app sends **only the selected drafts** to a `bulkCreateMCQ` action.
  - Either **all selected cards are created**, or **none** (no partial saves).
- On success:
  - The panel closes.
  - A success toast appears: e.g. _"Saved 4 new MCQs to {deck}"_.
  - Focus returns to the PDF viewer so the user can immediately select the next block of text.
- On failure:
  - An error toast is shown.
  - The panel remains open with all edits intact so the user can retry.

### R1.5 – Tag Handling for Batch Drafts

- Session Tag Presets (Feature Set 2) are automatically applied to each saved card.
- AI-suggested tags are:
  - Normalized (trimmed, lowercased except for proper nouns),
  - De-duplicated against Session Tags,
  - Saved as user tags if they don't already exist.
- Tag logic must be consistent with existing V5 tag policies and RLS.

---

## Feature Set 2 – Session Tag Presets (Sticky Context)

### R2.1 – Session Tag Selector

- At the top of the Bulk Import page, there is a **"Session Tags"** control.
- It uses the existing TagSelector UI:
  - User can add/remove tags from a multi-select.
  - New tags created here behave like normal user tags.
- Session Tags:
  - Are stored in page state.
  - Are persisted in `localStorage` under a deck-specific key (e.g. `session_tags_{deckId}`).
  - Are reloaded automatically when revisiting the Bulk Import page for that deck.

### R2.2 – Session Tags Application Rules

- Any card created from the Bulk Import page gets the Session Tags:
  - Single-card manual creation.
  - Single-card AI Draft.
  - Batch AI Draft / Bulk Save.
- If the user clears Session Tags, they are no longer applied to newly created cards.

### R2.3 – Interaction with Existing Tags

- Session Tags must coexist with per-card tags chosen in the regular tag selector:
  - No duplicate tags on a single card (by name).
  - No breaking of existing Tag filtering on the Deck page.

---

## Feature Set 3 – Power-User Shortcuts

### R3.1 – Hotkeys on Bulk Import Page

- **Cmd+Enter / Ctrl+Enter**:
  - When the single-card form is active, triggers the existing "Add MCQ" save action.
- **Shift+Cmd+Enter / Shift+Ctrl+Enter**:
  - When there is selected text in the PDF viewer, triggers **AI Batch Draft**.
  - If no text is selected, shows a subtle hint/toast and does nothing.
- **Esc**:
  - If Batch Review Panel is open, closes the panel.
  - Else, clears any active PDF selection tooltip but does not clear the form.

### R3.2 – Safety & Focus

- Shortcuts must not interfere with standard input behavior:
  - If a user presses Cmd+Enter while a textarea is focused but the form is invalid, show a validation error and don't crash.
- After:
  - Single-card save, or
  - Successful Batch Save,
  - Keyboard focus is moved back to the PDF viewer container.

---

## Non-Functional Requirements

### NFR-1 – Performance & Limits

- Batch AI calls must complete within the existing API timeout.
- Batch size is capped at ~5 questions per call.
- UI clearly indicates loading state and prevents duplicate submissions.

### NFR-2 – Reliability & Errors

- All AI responses are validated via Zod before being shown.
- A malformed AI response:
  - Shows a friendly error message.
  - Does not break the page.
- Bulk save protects against partial writes.

### NFR-3 – Mobile UX

- Batch Review Panel becomes full-screen on small screens.
- Shortcuts are desktop-only; mobile devices are not required to support them.
