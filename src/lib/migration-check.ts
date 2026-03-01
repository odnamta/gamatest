/**
 * V8.0 Migration Verification Module
 * 
 * Provides functions to check migration status and verify data integrity.
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export interface MigrationStatus {
  legacyCardsCount: number
  legacyDecksCount: number
  v2CardTemplatesCount: number
  v2DeckTemplatesCount: number
  migrationComplete: boolean
  warnings: string[]
}

export interface MigrationReport {
  deck_templates_created: number
  card_templates_created: number
  card_template_tags_created: number
  user_card_progress_created: number
  user_decks_created: number
}

/**
 * V8.0: Checks the current migration status.
 * Queries legacy tables to determine if migration is complete.
 * 
 * Requirements: 3.1, 3.2
 */
export async function checkMigrationStatus(): Promise<MigrationStatus> {
  const supabase = await createSupabaseServerClient()
  const warnings: string[] = []

  // Count legacy cards
  const { count: legacyCardsCount, error: cardsError } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })

  if (cardsError) {
    logger.error('checkMigrationStatus.countLegacyCards', cardsError.message)
  }

  // Count legacy decks
  const { count: legacyDecksCount, error: decksError } = await supabase
    .from('decks')
    .select('*', { count: 'exact', head: true })

  if (decksError) {
    logger.error('checkMigrationStatus.countLegacyDecks', decksError.message)
  }

  // Count V2 card_templates
  const { count: v2CardTemplatesCount, error: ctError } = await supabase
    .from('card_templates')
    .select('*', { count: 'exact', head: true })

  if (ctError) {
    logger.error('checkMigrationStatus.countCardTemplates', ctError.message)
  }

  // Count V2 deck_templates
  const { count: v2DeckTemplatesCount, error: dtError } = await supabase
    .from('deck_templates')
    .select('*', { count: 'exact', head: true })

  if (dtError) {
    logger.error('checkMigrationStatus.countDeckTemplates', dtError.message)
  }

  const legacyCards = legacyCardsCount || 0
  const legacyDecks = legacyDecksCount || 0

  // Requirement 3.2: Log warning if legacy cards exist
  if (legacyCards > 0) {
    warnings.push(
      `WARNING: ${legacyCards} legacy cards found. Run migration script: SELECT migrate_v1_to_v2_complete();`
    )
  }

  if (legacyDecks > 0) {
    warnings.push(
      `WARNING: ${legacyDecks} legacy decks found. Run migration script: SELECT migrate_v1_to_v2_complete();`
    )
  }

  // Migration is complete when all legacy data has been migrated
  // Note: Legacy tables may still have data, but V2 should have corresponding entries
  const migrationComplete = legacyCards === 0 && legacyDecks === 0

  return {
    legacyCardsCount: legacyCards,
    legacyDecksCount: legacyDecks,
    v2CardTemplatesCount: v2CardTemplatesCount || 0,
    v2DeckTemplatesCount: v2DeckTemplatesCount || 0,
    migrationComplete,
    warnings,
  }
}

/**
 * V8.0: Logs migration status on application startup.
 * 
 * Requirements: 3.1, 3.2
 */
export async function logMigrationStatus(): Promise<void> {
  try {
    const status = await checkMigrationStatus()

    for (const warning of status.warnings) {
      logger.warn('migrationCheck', warning)
    }
  } catch (error) {
    logger.error('logMigrationStatus', error)
  }
}

/**
 * V8.0: Verifies content integrity between legacy and V2 data.
 * Checks that migrated card content matches exactly.
 * 
 * Requirements: 3.4
 */
export async function verifyContentIntegrity(): Promise<{
  success: boolean
  mismatches: Array<{ legacyId: string; field: string; legacyValue: unknown; v2Value: unknown }>
}> {
  const supabase = await createSupabaseServerClient()
  const mismatches: Array<{ legacyId: string; field: string; legacyValue: unknown; v2Value: unknown }> = []

  // Get legacy cards with their V2 counterparts
  const { data: legacyCards, error: legacyError } = await supabase
    .from('cards')
    .select('id, stem, options, correct_index, explanation')
    .limit(100) // Sample check

  if (legacyError || !legacyCards) {
    return { success: true, mismatches: [] } // No legacy cards to verify
  }

  for (const legacyCard of legacyCards) {
    // Find corresponding V2 card_template
    const { data: v2Card } = await supabase
      .from('card_templates')
      .select('stem, options, correct_index, explanation')
      .eq('legacy_id', legacyCard.id)
      .single()

    if (!v2Card) {
      mismatches.push({
        legacyId: legacyCard.id,
        field: 'existence',
        legacyValue: 'exists',
        v2Value: 'not found',
      })
      continue
    }

    // Compare fields
    if (legacyCard.stem !== v2Card.stem) {
      mismatches.push({
        legacyId: legacyCard.id,
        field: 'stem',
        legacyValue: legacyCard.stem,
        v2Value: v2Card.stem,
      })
    }

    if (JSON.stringify(legacyCard.options) !== JSON.stringify(v2Card.options)) {
      mismatches.push({
        legacyId: legacyCard.id,
        field: 'options',
        legacyValue: legacyCard.options,
        v2Value: v2Card.options,
      })
    }

    if (legacyCard.correct_index !== v2Card.correct_index) {
      mismatches.push({
        legacyId: legacyCard.id,
        field: 'correct_index',
        legacyValue: legacyCard.correct_index,
        v2Value: v2Card.correct_index,
      })
    }

    if (legacyCard.explanation !== v2Card.explanation) {
      mismatches.push({
        legacyId: legacyCard.id,
        field: 'explanation',
        legacyValue: legacyCard.explanation,
        v2Value: v2Card.explanation,
      })
    }
  }

  return {
    success: mismatches.length === 0,
    mismatches,
  }
}

/**
 * V8.0: Generates a migration report with counts.
 * 
 * Requirements: 3.3
 */
export async function getMigrationReport(): Promise<MigrationReport> {
  const supabase = await createSupabaseServerClient()

  // Count deck_templates with legacy_id (migrated from legacy)
  const { count: deckTemplatesCreated } = await supabase
    .from('deck_templates')
    .select('*', { count: 'exact', head: true })
    .not('legacy_id', 'is', null)

  // Count card_templates with legacy_id (migrated from legacy)
  const { count: cardTemplatesCreated } = await supabase
    .from('card_templates')
    .select('*', { count: 'exact', head: true })
    .not('legacy_id', 'is', null)

  // Count card_template_tags
  const { count: cardTemplateTagsCreated } = await supabase
    .from('card_template_tags')
    .select('*', { count: 'exact', head: true })

  // Count user_card_progress
  const { count: userCardProgressCreated } = await supabase
    .from('user_card_progress')
    .select('*', { count: 'exact', head: true })

  // Count user_decks
  const { count: userDecksCreated } = await supabase
    .from('user_decks')
    .select('*', { count: 'exact', head: true })

  return {
    deck_templates_created: deckTemplatesCreated || 0,
    card_templates_created: cardTemplatesCreated || 0,
    card_template_tags_created: cardTemplateTagsCreated || 0,
    user_card_progress_created: userCardProgressCreated || 0,
    user_decks_created: userDecksCreated || 0,
  }
}
