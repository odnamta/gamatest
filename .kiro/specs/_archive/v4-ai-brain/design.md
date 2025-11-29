# Design Document: V4 - AI Brain (MCQ Drafting)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Bulk Import Page                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ PDF Viewer / │  │  AI Draft    │  │   CreateMCQForm       │  │
│  │ Text Area    │──│  Button      │──│   (populated)         │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Server Action Layer                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  draftMCQFromText(sourceText, deckId, deckName?)         │   │
│  │    1. Validate input (Zod)                               │   │
│  │    2. Call OpenAI API (model + temp from config)         │   │
│  │    3. Parse & validate response (Zod)                    │   │
│  │    4. Return MCQDraft | Error                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OpenAI API                                  │
│  Model: configurable (default gpt-4o)                            │
│  Temperature: 0.2 (for factual accuracy)                         │
│  Format: JSON Object                                             │
│  System: Medical board exam expert prompt                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User selects text in source textarea
            │
            ▼
User clicks "✨ AI Draft" button
            │
     ┌──────┴──────┐
     │ Selection?  │
     └──────┬──────┘
            │ No → Show toast "Please select some text first" → STOP
            │ Yes ↓
            ▼
     ┌──────┴──────┐
     │ Rate limit? │
     └──────┬──────┘
            │ Yes → Show toast "Please wait a moment" → STOP
            │ No ↓
            ▼
Button shows "Generating..." + spinner (disabled)
            │
            ▼
Client calls draftMCQFromText server action
  - sourceText: selected text
  - deckId: current deck UUID
  - deckName: deck title (for prompt context)
            │
            ▼
Server validates sourceText.length >= 50
            │
     ┌──────┴──────┐
     │ Too short?  │
     └──────┬──────┘
            │ Yes → Return { ok: false, error: 'TEXT_TOO_SHORT' }
            │ No ↓
            ▼
Server calls OpenAI chat.completions.create
  - model: MCQ_MODEL (from config)
  - temperature: MCQ_TEMPERATURE (from config)
  - response_format: { type: "json_object" }
  - system prompt: medical MCQ expert
  - user prompt: sourceText + deckName
            │
     ┌──────┴──────┐
     │ API Error?  │
     └──────┬──────┘
            │ Yes → Return { ok: false, error: 'OPENAI_ERROR' }
            │ No ↓
            ▼
Server parses JSON response with Zod mcqDraftSchema
            │
     ┌──────┴──────┐
     │ Parse fail? │
     └──────┬──────┘
            │ Yes → Return { ok: false, error: 'PARSE_ERROR' }
            │ No ↓
            ▼
Return { ok: true, draft: MCQDraft }
            │
            ▼
Client receives result
            │
     ┌──────┴──────┐
     │   ok?       │
     └──────┬──────┘
            │ No → Show error toast, re-enable button
            │ Yes ↓
            ▼
Populate CreateMCQForm with draft data
  - stem → initialStem
  - options → initialOptions
  - correct_index → initialCorrectIndex
  - explanation → initialExplanation
            │
            ▼
User reviews, edits, clicks "Create" to save
```

## API & Schema Design

### AI Configuration
```typescript
// src/lib/ai-config.ts
export const MCQ_MODEL = process.env.MCQ_MODEL ?? 'gpt-4o'
export const MCQ_TEMPERATURE = parseFloat(process.env.MCQ_TEMPERATURE ?? '0.2')
```

### Input Schema
```typescript
const draftMCQInputSchema = z.object({
  sourceText: z.string().min(50, 'Select at least 50 characters'),
  deckId: z.string().uuid(),
  deckName: z.string().optional(),
})
```

### Output Schema (from OpenAI)
```typescript
const mcqDraftSchema = z.object({
  stem: z.string().min(10),
  options: z.array(z.string()).length(5),
  correct_index: z.number().int().min(0).max(4),
  explanation: z.string().min(10),
})

type MCQDraft = z.infer<typeof mcqDraftSchema>
```

### Result Union
```typescript
type MCQDraftResult =
  | { ok: true; draft: MCQDraft }
  | { ok: false; error: 'TEXT_TOO_SHORT' | 'OPENAI_ERROR' | 'PARSE_ERROR' }
```

### OpenAI Prompt Design

**System Prompt:**
```
You are a medical board exam expert specializing in obstetrics and gynecology. 
Given source text from a medical textbook or reference, create EXACTLY ONE 
high-quality multiple-choice question (MCQ) suitable for a board-style exam.

Return valid JSON with these exact fields:
- stem: The question text (clinical vignette or direct question)
- options: Array of exactly 5 answer choices (A through E)
- correct_index: Index of correct answer (0-4)
- explanation: Concise teaching explanation for why the answer is correct

Guidelines:
- Write at a board exam difficulty level
- Include relevant clinical details in the stem
- Make distractors plausible but clearly incorrect
- Explanation should teach the key concept
```

**User Prompt:**
```
Source text:
{sourceText}

Deck/topic: {deckName}

Generate one MCQ based on this content, aligned with the deck/topic if possible.
```

The server action SHOULD include deck name or topic (if available) in the user prompt to steer the question towards the intended syllabus area.

## Error Handling Strategy

| Error Type | Cause | User Message | Recovery |
|------------|-------|--------------|----------|
| No selection | User clicked without selecting | "Please select some text first" | Select text |
| TEXT_TOO_SHORT | < 50 chars selected | "Please select a longer paragraph" | Select more text |
| OPENAI_ERROR | API timeout, rate limit, auth | "Something went wrong. Try again." | Retry button |
| PARSE_ERROR | Invalid JSON from OpenAI | "Something went wrong. Try again." | Retry button |
| Rate limited | < 3s since last call | "Please wait a moment" | Wait and retry |

## UI/UX Flow

### Step 1: Text Selection
- User reads PDF content in left panel
- User highlights/selects relevant text
- Selection is captured in state

### Step 2: AI Draft Trigger
- User clicks "✨ AI Draft" button
- If no selection → toast "Please select some text first"
- If rate limited → toast "Please wait a moment"
- Otherwise → button changes to "Generating..." with spinner, disabled

### Step 3: Generation
- Server action executes (typically 2-5 seconds)
- UI remains responsive

### Step 4a: Success
- Form fields populate with AI-generated content
- All fields are editable
- Helper text reminds user to review

### Step 4b: Error
- Toast notification appears with appropriate message
- Button re-enables
- Form state unchanged

### Step 5: Review & Save
- User reviews/edits the generated MCQ
- User clicks "Create" to save to deck
- Standard save flow continues

## File Structure

```
src/
├── lib/
│   ├── openai-client.ts      # OpenAI client initialization
│   ├── ai-config.ts          # Model/temperature config
│   └── mcq-draft-schema.ts   # Zod schemas for MCQ drafting
├── actions/
│   └── ai-actions.ts         # draftMCQFromText server action
└── app/(app)/decks/[deckId]/add-bulk/
    └── page.tsx              # Updated with AI Draft integration
```

## Future Extensions

### Multi-MCQ Generation
Extend the prompt to generate 3-5 MCQs from longer text passages. Return as array, let user pick which to keep.

### Flashcard Generation
Reuse the OpenAI client and similar prompt structure to generate front/back flashcard pairs from source text.

### Distractor Suggestions
For existing MCQs with fewer than 5 options, AI can suggest additional plausible distractors.

### Quality Scoring
Use AI to evaluate existing MCQs for quality metrics (clarity, difficulty, distractor plausibility).
