import type { Card } from './database';

/**
 * V11.5: Unified ActionResult type
 * Use { ok: true/false } pattern for new actions.
 * @deprecated { success: true/false } pattern - use ActionResultV2 instead
 */
export type ActionResult =
  | { success: true; data?: unknown }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * V11.5: New standardized action result type.
 * Prefer this over ActionResult for new server actions.
 */
export type ActionResultV2<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type NextCardResult =
  | { success: true; nextCard: Card | null; remainingCount: number }
  | { success: false; error: string };

/**
 * V11.6: Draft card summary for Drafts Workspace
 * Used by getDeckDrafts and DeckDraftsPanel component.
 * 
 * **Feature: v11.6-bulk-import-reliability**
 * **Validates: Requirements 1.2**
 */
export interface DraftCardSummary {
  id: string
  questionNumber: number | null
  stem: string
  tags: Array<{ id: string; name: string; color: string; category: string }>
  importSessionId: string | null
  createdAt: string
}
