'use server'

import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE } from '@/lib/ai-config'
import { logger } from '@/lib/logger'
import { withUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import {
  draftMCQInputSchema,
  mcqDraftSchema,
  type DraftMCQInput,
  type MCQDraftResult,
  type AIMode,
} from '@/lib/mcq-draft-schema'
import {
  getSingleSystemPrompt as getSystemPrompt,
  buildMessageContent,
} from '@/lib/ai-prompts'

/**
 * Builds the user prompt with source text and optional deck context.
 */
function buildUserPrompt(sourceText: string, deckName?: string, mode: AIMode = 'extract'): string {
  let prompt = `Source text:\n${sourceText}`

  if (deckName) {
    prompt += `\n\nDeck/topic: ${deckName}`
  }

  if (mode === 'extract') {
    prompt += '\n\nExtract the MCQ from this content. Return JSON with stem, options, correct_index, and explanation.'
  } else {
    prompt += '\n\nGenerate one MCQ based on this content, aligned with the deck/topic if possible.'
  }

  return prompt
}

/**
 * Server Action: Generate an MCQ draft from source text using OpenAI.
 * 
 * @param input - Source text, deck ID, optional deck name, mode, and image
 * @returns MCQDraftResult - Either { ok: true, draft } or { ok: false, error }
 * 
 * Requirements: FR-2, V6.2 Brain Toggle, V6.2 Vision MVP
 */
export async function draftMCQFromText(input: DraftMCQInput): Promise<MCQDraftResult> {
  // Check if OpenAI API key is configured (server-side only)
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('draftMCQFromText', 'OPENAI_API_KEY not set')
    return { ok: false, error: 'NOT_CONFIGURED' }
  }

  // Validate input with Zod schema (FR-2.1, FR-2.2)
  const validationResult = draftMCQInputSchema.safeParse(input)

  if (!validationResult.success) {
    return { ok: false, error: 'TEXT_TOO_SHORT' }
  }

  return withUser(async () => {
    const { sourceText, deckName, mode = 'extract', subject, imageBase64, imageUrl } = validationResult.data

    try {
      // Build message content (with optional image for Vision MVP)
      const userContent = buildMessageContent(
        buildUserPrompt(sourceText, deckName, mode),
        imageBase64,
        imageUrl
      )

      // Call OpenAI API (FR-2.3, FR-2.4)
      // V9.1: Pass subject to getSystemPrompt for dynamic specialty
      const response = await openai.chat.completions.create({
        model: MCQ_MODEL,
        temperature: MCQ_TEMPERATURE,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: getSystemPrompt(mode, subject) },
          { role: 'user', content: userContent as string },
        ],
      })

      // Extract content from response
      const content = response.choices[0]?.message?.content

      if (!content) {
        logger.error('draftMCQFromText', 'OpenAI returned empty content')
        return { ok: false, error: 'OPENAI_ERROR' }
      }

      // Parse JSON response
      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch {
        logger.error('draftMCQFromText.parseJSON', content)
        return { ok: false, error: 'PARSE_ERROR' }
      }

      // Validate against MCQ schema (FR-2.5)
      const draftResult = mcqDraftSchema.safeParse(parsed)

      if (!draftResult.success) {
        logger.error('draftMCQFromText.validation', draftResult.error.issues)
        return { ok: false, error: 'PARSE_ERROR' }
      }

      // Success! Return the validated draft (FR-2.6)
      return { ok: true, draft: draftResult.data }

    } catch (error) {
      // Handle API errors (network, auth, rate limits, etc.)
      logger.error('draftMCQFromText', error)
      return { ok: false, error: 'OPENAI_ERROR' }
    }
  }, RATE_LIMITS.sensitive) as Promise<MCQDraftResult>
}
