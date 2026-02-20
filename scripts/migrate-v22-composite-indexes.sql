-- Migration V22: Composite Indexes for Query Performance
-- Date: 2026-02-20
--
-- Adds composite indexes for frequently queried column pairs that currently
-- only have single-column indexes. These support the most common query patterns
-- in the application (filtering, joining, and sorting).
--
-- Uses CONCURRENTLY to avoid locking tables during creation.
-- NOTE: CONCURRENTLY cannot run inside a transaction — run each statement individually.

-- 1. card_template_tags(card_template_id, tag_id)
-- Used in: tag merge, auto-tag upsert, tag filtering, study actions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_template_tags_composite
  ON card_template_tags (card_template_id, tag_id);

-- 2. card_templates(deck_template_id, status)
-- Used in: study actions filter published cards, assessment question selection
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_templates_deck_status
  ON card_templates (deck_template_id, status);

-- 3. assessment_sessions(assessment_id, status)
-- Used in: session counting, completion checks, statistics, percentile
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_assessment_status
  ON assessment_sessions (assessment_id, status);

-- 4. assessment_sessions(user_id, created_at DESC)
-- Used in: getMyAssessmentSessions, org member activity, cohort analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_sessions_user_date
  ON assessment_sessions (user_id, created_at DESC);

-- 5. user_decks(user_id, is_active)
-- Used in: active subscription filtering in study/library actions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_decks_user_active
  ON user_decks (user_id, is_active);

-- 6. organization_members(org_id, user_id)
-- Used in: membership lookups, RLS policies, role checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_composite
  ON organization_members (org_id, user_id);

-- 7. deck_templates(org_id, visibility)
-- Used in: library browsing public decks per org
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deck_templates_org_visibility
  ON deck_templates (org_id, visibility);
