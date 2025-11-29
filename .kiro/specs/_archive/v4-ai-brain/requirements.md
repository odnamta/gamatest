# Requirements: V4 - AI Brain (MCQ Drafting)

## Overview

V4 introduces AI-powered MCQ generation to the Bulk Import workflow. Users can select text from their PDF source material and click "AI Draft" to have GPT-4o generate a high-quality, board-style multiple-choice question that they can review, edit, and save.

## Goals

1. **Speed up MCQ creation** — Reduce time from reading source material to having a draft question
2. **Maintain quality control** — AI generates drafts, humans review and approve
3. **Safe integration** — API keys never exposed to client, proper error handling
4. **Seamless UX** — Integrates naturally into existing Bulk Import workflow

## Non-Goals

- Auto-saving AI-generated content (user must explicitly save)
- Batch generation of multiple MCQs at once (future extension)
- Flashcard generation (future extension)
- Fine-tuning or custom models

## User Stories

### US-1: Busy Doctor Converting PDF to MCQs
As a busy medical professional, I want to select a paragraph from my PDF and have AI draft a board-style MCQ, so that I can quickly build my study deck without writing questions from scratch.

### US-2: Power User Doing Rapid Drafting
As a power user creating many questions, I want the AI draft to populate the form instantly so I can review, tweak, and save in rapid succession.

### US-3: Handling AI Unavailability
As a user, when the AI service is unavailable or returns an error, I want clear feedback so I know to try again or write the question manually.

## Functional Requirements

### FR-1: AI Draft Button
1. The "AI Draft" button SHALL be enabled at all times (not grayed out)
2. The button SHALL show "Generating…" with a spinner while the request is in flight
3. The button SHALL be disabled during generation to prevent duplicate requests
4. IF no text is selected when the user clicks "AI Draft", the client SHALL show a toast "Please select some text first" and SHALL NOT call the server action

### FR-2: Server Action - draftMCQFromText
1. The action SHALL accept `{ sourceText: string; deckId: string; deckName?: string }` as input
2. The action SHALL validate that `sourceText` is at least 50 characters
3. The action SHALL call OpenAI's chat completions API with configurable model (default `gpt-4o`)
4. The action SHALL use `response_format: { type: 'json_object' }` for reliable parsing
5. The action SHALL validate the response against a Zod schema requiring:
   - `stem`: string (the question)
   - `options`: array of exactly 5 strings (A-E)
   - `correct_index`: number 0-4
   - `explanation`: string
6. The action SHALL return a discriminated union result:
   - Success: `{ ok: true; draft: MCQDraft }`
   - Failure: `{ ok: false; error: 'TEXT_TOO_SHORT' | 'OPENAI_ERROR' | 'PARSE_ERROR' }`

### FR-3: Form Population
1. On successful AI draft, the CreateMCQForm SHALL be populated with the generated content
2. All populated fields SHALL be fully editable by the user
3. The form SHALL NOT auto-submit; user must click "Create" to save

### FR-4: Error Handling
1. For `TEXT_TOO_SHORT`, show toast: "Please select a longer paragraph (at least 50 characters)"
2. For `OPENAI_ERROR` or `PARSE_ERROR`, show toast: "Something went wrong. Please try again."
3. For no selection, show toast: "Please select some text first"

### FR-5: Safety Guardrails
1. Helper text SHALL appear under the AI Draft button: "AI generates a draft. Always review before saving."
2. Client-side rate limiting SHALL prevent more than 1 AI call per 3 seconds
3. AI-generated drafts SHALL always require manual review and explicit saving. The system SHALL NOT present AI output as "approved" medical content.

## Non-Functional Requirements

### NFR-1: Security
1. OpenAI API key SHALL only be accessed server-side
2. API key SHALL NOT be exposed in client bundles or network responses
3. The system SHOULD avoid sending any real patient identifiers or sensitive personal data to OpenAI. Source text SHOULD be limited to de-identified educational content.

### NFR-2: Performance
- AI draft request SHOULD complete within 10 seconds under normal conditions
- UI SHOULD remain responsive during AI generation

### NFR-3: Reliability
- Failed requests SHALL NOT corrupt form state
- Network errors SHALL be caught and reported gracefully

### NFR-4: Configurability
- Model name and temperature SHALL be configurable via environment variables or config file
- Default model: `gpt-4o`, default temperature: `0.2`

## Open Questions

1. ~~Should we offer model selection (gpt-4o vs gpt-4o-mini for cost savings)?~~ → Resolved: Use config file
2. Should we track AI usage per user for analytics/billing?
3. ~~Should AI-generated fields have visual distinction until edited?~~ → Deferred to future version
