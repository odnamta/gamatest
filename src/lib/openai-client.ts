import OpenAI from 'openai'

/**
 * OpenAI Client for Server-Side Use Only
 * 
 * This module initializes and exports a typed OpenAI client.
 * IMPORTANT: This should only be imported in server-side code (Server Actions, API routes).
 * 
 * Requirements: NFR-1.1, NFR-1.2
 */

// Server-only guard: prevent accidental client-side import
if (typeof window !== 'undefined') {
  throw new Error(
    'openai-client.ts should only be imported on the server. ' +
    'Do not import this module in client components.'
  )
}

// Validate API key exists
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    'OPENAI_API_KEY is not set. AI features will not work. ' +
    'Add OPENAI_API_KEY to your .env.local file.'
  )
}

/**
 * Singleton OpenAI client instance.
 * Initialized with API key from environment variables.
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
