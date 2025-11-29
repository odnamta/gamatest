# Implementation Plan

## Feature Set 1: AI Integration

- [x] 1. Setup OpenAI integration
  - [x] 1.1 Install OpenAI SDK
    - Run `npm install openai`
    - Verify package added to package.json dependencies
    - _Requirements: FR-2_
  - [x] 1.2 Configure environment variables
    - Add `OPENAI_API_KEY` to `.env.local`
    - Add `OPENAI_API_KEY=your-key-here` placeholder to `.env.local.example`
    - _Requirements: NFR-1_
  - [x] 1.3 Create AI config module
    - Create `src/lib/ai-config.ts`
    - Export `MCQ_MODEL` (default: `gpt-4o`, configurable via `process.env.MCQ_MODEL`)
    - Export `MCQ_TEMPERATURE` (default: `0.2`, configurable via `process.env.MCQ_TEMPERATURE`)
    - _Requirements: NFR-4_
  - [x] 1.4 Create OpenAI client module
    - Create `src/lib/openai-client.ts`
    - Initialize OpenAI client with `process.env.OPENAI_API_KEY`
    - Add server-only check to prevent client-side import
    - Export typed client instance
    - _Requirements: NFR-1_

- [x] 2. Create MCQ draft schemas and types
  - [x] 2.1 Create Zod schemas for MCQ drafting
    - Create `src/lib/mcq-draft-schema.ts`
    - Define `draftMCQInputSchema` with sourceText (min 50 chars), deckId, and optional deckName
    - Define `mcqDraftSchema` with stem, options (array of 5), correct_index (0-4), explanation
    - Export `MCQDraft` type via `z.infer<typeof mcqDraftSchema>`
    - _Requirements: FR-2.5_
  - [x] 2.2 Create result union type
    - Define `MCQDraftResult` discriminated union type
    - Success variant: `{ ok: true; draft: MCQDraft }`
    - Error variants: `{ ok: false; error: 'TEXT_TOO_SHORT' | 'OPENAI_ERROR' | 'PARSE_ERROR' }`
    - _Requirements: FR-2.6_

- [x] 3. Implement draftMCQFromText server action
  - [x] 3.1 Create AI actions file
    - Create `src/actions/ai-actions.ts`
    - Add 'use server' directive
    - Import OpenAI client, config, and schemas
    - _Requirements: FR-2_
  - [x] 3.2 Implement input validation
    - Validate input with `draftMCQInputSchema.safeParse`
    - Return `{ ok: false, error: 'TEXT_TOO_SHORT' }` if validation fails
    - _Requirements: FR-2.1, FR-2.2_
  - [x] 3.3 Implement OpenAI API call
    - Call `openai.chat.completions.create` with model from `MCQ_MODEL` config
    - Set temperature from `MCQ_TEMPERATURE` config
    - Use `response_format: { type: 'json_object' }`
    - System prompt: medical board exam expert for OBGYN MCQs
    - User prompt: include sourceText and deckName (if provided) for topic alignment
    - Wrap in try/catch, return `OPENAI_ERROR` on API failure
    - _Requirements: FR-2.3, FR-2.4_
  - [x] 3.4 Parse and validate OpenAI response
    - Extract JSON content from response
    - Parse with `mcqDraftSchema.safeParse`
    - Return `{ ok: false, error: 'PARSE_ERROR' }` if validation fails
    - Return `{ ok: true, draft }` on success
    - _Requirements: FR-2.5, FR-2.6_

- [x] 4. Checkpoint - Verify server action
  - Test server action with sample text
  - Confirm valid MCQ structure returned
  - Confirm error handling works

## Feature Set 2: UI Integration

- [x] 5. Update Bulk Import page for AI drafting
  - [x] 5.1 Add AI draft state management
    - Add `isGenerating: boolean` state
    - Add `lastGenerateTime: number` state for rate limiting (3 second window)
    - Add `aiDraft: MCQDraft | null` state
    - _Requirements: FR-1, FR-5.2_
  - [x] 5.2 Wire up AI Draft button
    - Import `draftMCQFromText` server action
    - On click: check if text is selected
    - If no selection: show toast "Please select some text first", do NOT call server action
    - If selection exists: get selected text and call server action with deckId and deckName
    - _Requirements: FR-1.1, FR-1.4, FR-4.3_
  - [x] 5.3 Implement rate limiting check
    - Before calling server action, check if 3 seconds have passed since `lastGenerateTime`
    - If rate limited: show toast "Please wait a moment before generating again"
    - Update `lastGenerateTime` after each generation attempt
    - _Requirements: FR-5.2_
  - [x] 5.4 Update button UI during generation
    - Set `isGenerating` true when starting request
    - Show "Generating..." text with spinner when `isGenerating`
    - Disable button during generation
    - Set `isGenerating` false when request completes (success or error)
    - _Requirements: FR-1.2, FR-1.3_
  - [x] 5.5 Populate form on successful draft
    - On success, set form fields from draft data
    - Populate stem, all 5 options, correct_index, explanation
    - Ensure all fields remain editable
    - _Requirements: FR-3.1, FR-3.2, FR-3.3_
  - [x] 5.6 Add helper text under AI Draft button
    - Add text: "AI generates a draft. Always review before saving."
    - Style with text-xs text-slate-500
    - _Requirements: FR-5.1, FR-5.3_

- [x] 6. Implement error handling
  - [x] 6.1 Show error toasts based on error type
    - `TEXT_TOO_SHORT`: "Please select a longer paragraph (at least 50 characters)"
    - `OPENAI_ERROR`: "Something went wrong. Please try again."
    - `PARSE_ERROR`: "Something went wrong. Please try again."
    - Use existing toast system from `useToast` hook
    - _Requirements: FR-4.1, FR-4.2_

- [x] 7. Checkpoint - Test UI integration
  - Test clicking AI Draft with no selection (should show toast)
  - Test selecting text and clicking AI Draft
  - Verify form populates correctly
  - Verify error toasts appear for each error type
  - Verify rate limiting works (rapid clicks)

## Feature Set 3: Testing

- [x] 8. Write property tests for AI drafting
  - [x] 8.1 Create AI draft test file
    - Create `src/__tests__/ai-draft.property.test.ts`
    - Set up mock for OpenAI client
    - _Requirements: FR-2_
  - [x] 8.2 Test valid response parsing
    - **Property 1: Valid MCQ Response Parsing**
    - Mock valid JSON response from OpenAI with stem, 5 options, correct_index, explanation
    - Verify parses to MCQDraft correctly
    - **Validates: FR-2.5**
  - [x] 8.3 Test invalid response handling
    - **Property 2: Invalid Response Returns PARSE_ERROR**
    - Mock invalid/malformed JSON response (missing fields, wrong types)
    - Verify returns `{ ok: false, error: 'PARSE_ERROR' }`
    - **Validates: FR-2.6**
  - [x] 8.4 Test short text validation
    - **Property 3: Short Text Returns TEXT_TOO_SHORT**
    - Test with text under 50 characters
    - Verify returns `{ ok: false, error: 'TEXT_TOO_SHORT' }`
    - **Validates: FR-2.2**

- [x] 9. Final Checkpoint
  - [x] 9.1 Run full test suite
    - Ensure all existing tests pass
    - Ensure new AI draft tests pass
  - [x] 9.2 Manual end-to-end test
    - Select text in Bulk Import page
    - Click AI Draft button
    - Verify form populates with generated MCQ
    - Edit fields and save
    - Verify MCQ saved to deck correctly
  - [x] 9.3 Security verification
    - Verify API key not in client bundle (check build output)
    - Verify server action only runs server-side
  - [x] 9.4 Commit and push
    - Commit all V4 changes
    - Push to GitHub
