-- Migration V12: Fix Supabase Advisor Issues
-- Fixes: RLS initplan, duplicate indexes, multiple permissive policies, security definer view, function search_path

-- ============================================================================
-- PART 1: Add missing indexes for foreign keys (4 issues)
-- ============================================================================

-- card_templates.author_id
CREATE INDEX IF NOT EXISTS idx_card_templates_author_id ON public.card_templates(author_id);

-- deck_sources.source_id
CREATE INDEX IF NOT EXISTS idx_deck_sources_source_id ON public.deck_sources(source_id);

-- lesson_progress.lesson_id
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);

-- user_card_progress.card_template_id
CREATE INDEX IF NOT EXISTS idx_user_card_progress_card_template_id ON public.user_card_progress(card_template_id);

-- ============================================================================
-- PART 2: Drop duplicate indexes (5 issues)
-- ============================================================================

-- card_templates: keep idx_card_templates_deck_template_id, drop idx_card_templates_deck
DROP INDEX IF EXISTS public.idx_card_templates_deck;

-- deck_templates: keep idx_deck_templates_author_id, drop idx_deck_templates_author
DROP INDEX IF EXISTS public.idx_deck_templates_author;

-- sources: keep idx_sources_user_id, drop idx_sources_user
DROP INDEX IF EXISTS public.idx_sources_user;

-- user_decks: keep idx_user_decks_deck_template_id, drop idx_user_decks_template
DROP INDEX IF EXISTS public.idx_user_decks_template;

-- user_decks: keep idx_user_decks_user_id, drop idx_user_decks_user
DROP INDEX IF EXISTS public.idx_user_decks_user;

-- ============================================================================
-- PART 3: Fix RLS policies - wrap auth.uid() with (select auth.uid())
-- This prevents re-evaluation for each row
-- ============================================================================

-- ----- decks table -----
DROP POLICY IF EXISTS "Users can view own decks" ON public.decks;
CREATE POLICY "Users can view own decks" ON public.decks
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own decks" ON public.decks;
CREATE POLICY "Users can insert own decks" ON public.decks
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own decks" ON public.decks;
CREATE POLICY "Users can update own decks" ON public.decks
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own decks" ON public.decks;
CREATE POLICY "Users can delete own decks" ON public.decks
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ----- cards table -----
DROP POLICY IF EXISTS "Users can view cards in own decks" ON public.cards;
CREATE POLICY "Users can view cards in own decks" ON public.cards
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can insert cards in own decks" ON public.cards;
CREATE POLICY "Users can insert cards in own decks" ON public.cards
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update cards in own decks" ON public.cards;
CREATE POLICY "Users can update cards in own decks" ON public.cards
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can delete cards in own decks" ON public.cards;
CREATE POLICY "Users can delete cards in own decks" ON public.cards
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = (select auth.uid())
  ));

-- ----- courses table -----
DROP POLICY IF EXISTS "Users can manage own courses" ON public.courses;
CREATE POLICY "Users can manage own courses" ON public.courses
  FOR ALL USING ((select auth.uid()) = user_id);

-- ----- units table -----
DROP POLICY IF EXISTS "Users can manage units in own courses" ON public.units;
CREATE POLICY "Users can manage units in own courses" ON public.units
  FOR ALL USING (EXISTS (
    SELECT 1 FROM courses WHERE courses.id = units.course_id AND courses.user_id = (select auth.uid())
  ));

-- ----- lessons table -----
DROP POLICY IF EXISTS "Users can manage lessons in own courses" ON public.lessons;
CREATE POLICY "Users can manage lessons in own courses" ON public.lessons
  FOR ALL USING (EXISTS (
    SELECT 1 FROM units
    JOIN courses ON courses.id = units.course_id
    WHERE units.id = lessons.unit_id AND courses.user_id = (select auth.uid())
  ));

-- ----- lesson_items table -----
DROP POLICY IF EXISTS "Users can manage lesson_items in own courses" ON public.lesson_items;
CREATE POLICY "Users can manage lesson_items in own courses" ON public.lesson_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM lessons
    JOIN units ON units.id = lessons.unit_id
    JOIN courses ON courses.id = units.course_id
    WHERE lessons.id = lesson_items.lesson_id AND courses.user_id = (select auth.uid())
  ));

-- ----- lesson_progress table -----
DROP POLICY IF EXISTS "Users can manage own lesson_progress" ON public.lesson_progress;
CREATE POLICY "Users can manage own lesson_progress" ON public.lesson_progress
  FOR ALL USING ((select auth.uid()) = user_id);

-- ----- sources table (consolidate duplicate INSERT policies) -----
DROP POLICY IF EXISTS "Users can manage own sources" ON public.sources;
DROP POLICY IF EXISTS "Users can create sources" ON public.sources;
CREATE POLICY "Users can manage own sources" ON public.sources
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----- user_stats table -----
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
CREATE POLICY "Users can view own stats" ON public.user_stats
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;
CREATE POLICY "Users can insert own stats" ON public.user_stats
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
CREATE POLICY "Users can update own stats" ON public.user_stats
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ----- study_logs table -----
DROP POLICY IF EXISTS "Users can view own logs" ON public.study_logs;
CREATE POLICY "Users can view own logs" ON public.study_logs
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own logs" ON public.study_logs;
CREATE POLICY "Users can insert own logs" ON public.study_logs
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own logs" ON public.study_logs;
CREATE POLICY "Users can update own logs" ON public.study_logs
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ----- card_tags table -----
DROP POLICY IF EXISTS "Users can manage card_tags for own cards" ON public.card_tags;
CREATE POLICY "Users can manage card_tags for own cards" ON public.card_tags
  FOR ALL USING (EXISTS (
    SELECT 1 FROM cards
    JOIN decks ON decks.id = cards.deck_id
    WHERE cards.id = card_tags.card_id AND decks.user_id = (select auth.uid())
  ));


-- ----- deck_templates table (consolidate duplicate policies) -----
DROP POLICY IF EXISTS "Authors can manage own deck_templates" ON public.deck_templates;
DROP POLICY IF EXISTS "Authors can update their own decks" ON public.deck_templates;
DROP POLICY IF EXISTS "Authors can create deck templates" ON public.deck_templates;

-- Single policy for author management (SELECT, UPDATE, DELETE)
CREATE POLICY "Authors can manage own deck_templates" ON public.deck_templates
  FOR ALL USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

-- Public read policy stays as-is (no auth.uid() call)
-- "Public deck_templates readable by all" - already optimal

-- ----- card_templates table (consolidate duplicate policies) -----
DROP POLICY IF EXISTS "Authors can manage card_templates in own decks" ON public.card_templates;
DROP POLICY IF EXISTS "Authors can read their own cards" ON public.card_templates;
DROP POLICY IF EXISTS "Authors can create card templates" ON public.card_templates;

-- Single policy for author management
CREATE POLICY "Authors can manage card_templates in own decks" ON public.card_templates
  FOR ALL USING (
    (select auth.uid()) = author_id
    OR EXISTS (
      SELECT 1 FROM deck_templates
      WHERE deck_templates.id = card_templates.deck_template_id
      AND deck_templates.author_id = (select auth.uid())
    )
  )
  WITH CHECK (
    (select auth.uid()) = author_id
    OR EXISTS (
      SELECT 1 FROM deck_templates
      WHERE deck_templates.id = card_templates.deck_template_id
      AND deck_templates.author_id = (select auth.uid())
    )
  );

-- Public read policy stays as-is (no auth.uid() call)
-- "Public card_templates readable by all" - already optimal

-- ----- user_decks table -----
DROP POLICY IF EXISTS "Users can manage own user_decks" ON public.user_decks;
CREATE POLICY "Users can manage own user_decks" ON public.user_decks
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----- user_card_progress table -----
DROP POLICY IF EXISTS "Users can manage own user_card_progress" ON public.user_card_progress;
CREATE POLICY "Users can manage own user_card_progress" ON public.user_card_progress
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----- tags table -----
DROP POLICY IF EXISTS "Users can manage their own tags" ON public.tags;
CREATE POLICY "Users can manage their own tags" ON public.tags
  FOR ALL USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ----- card_template_tags table -----
DROP POLICY IF EXISTS "Users can link their own cards" ON public.card_template_tags;
CREATE POLICY "Users can link their own cards" ON public.card_template_tags
  FOR ALL USING (EXISTS (
    SELECT 1 FROM card_templates
    WHERE card_templates.id = card_template_tags.card_template_id
    AND card_templates.author_id = (select auth.uid())
  ));

-- ----- deck_sources table -----
DROP POLICY IF EXISTS "Users can manage deck_sources for own decks" ON public.deck_sources;
CREATE POLICY "Users can manage deck_sources for own decks" ON public.deck_sources
  FOR ALL USING (EXISTS (
    SELECT 1 FROM deck_templates
    WHERE deck_templates.id = deck_sources.deck_id
    AND deck_templates.author_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM deck_templates
    WHERE deck_templates.id = deck_sources.deck_id
    AND deck_templates.author_id = (select auth.uid())
  ));

-- ----- book_sources table -----
DROP POLICY IF EXISTS "Authors can manage own book_sources" ON public.book_sources;
CREATE POLICY "Authors can manage own book_sources" ON public.book_sources
  FOR ALL USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

-- ----- book_chapters table -----
DROP POLICY IF EXISTS "Authors can manage chapters in own books" ON public.book_chapters;
CREATE POLICY "Authors can manage chapters in own books" ON public.book_chapters
  FOR ALL USING (EXISTS (
    SELECT 1 FROM book_sources
    WHERE book_sources.id = book_chapters.book_source_id
    AND book_sources.author_id = (select auth.uid())
  ));

-- ----- matching_groups table -----
DROP POLICY IF EXISTS "Authors can manage matching_groups via chapter" ON public.matching_groups;
CREATE POLICY "Authors can manage matching_groups via chapter" ON public.matching_groups
  FOR ALL USING (
    chapter_id IS NULL
    OR EXISTS (
      SELECT 1 FROM book_chapters
      JOIN book_sources ON book_sources.id = book_chapters.book_source_id
      WHERE book_chapters.id = matching_groups.chapter_id
      AND book_sources.author_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PART 4: Fix security definer view
-- ============================================================================

-- Drop and recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS public.user_topic_accuracy;
CREATE VIEW public.user_topic_accuracy AS
SELECT 
  ucp.user_id,
  t.id AS tag_id,
  t.name AS tag_name,
  t.color AS tag_color,
  sum(ucp.correct_count) AS correct_count,
  sum(ucp.total_attempts) AS total_attempts,
  CASE
    WHEN sum(ucp.total_attempts) > 0 
    THEN sum(ucp.correct_count)::double precision / sum(ucp.total_attempts)::double precision * 100::double precision
    ELSE NULL::double precision
  END AS accuracy
FROM user_card_progress ucp
JOIN card_templates ct ON ct.id = ucp.card_template_id
JOIN card_template_tags ctt ON ctt.card_template_id = ct.id
JOIN tags t ON t.id = ctt.tag_id
WHERE t.category = 'topic'::tag_category
GROUP BY ucp.user_id, t.id, t.name, t.color;

-- Grant appropriate permissions
GRANT SELECT ON public.user_topic_accuracy TO authenticated;

-- ============================================================================
-- PART 5: Fix functions with mutable search_path
-- ============================================================================

-- Fix check_migration_status function
CREATE OR REPLACE FUNCTION public.check_migration_status()
RETURNS TABLE(
  has_legacy_data boolean,
  legacy_deck_count bigint,
  legacy_card_count bigint,
  template_deck_count bigint,
  template_card_count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) > 0 FROM decks WHERE user_id = auth.uid()) as has_legacy_data,
    (SELECT COUNT(*) FROM decks WHERE user_id = auth.uid()) as legacy_deck_count,
    (SELECT COUNT(*) FROM cards c JOIN decks d ON c.deck_id = d.id WHERE d.user_id = auth.uid()) as legacy_card_count,
    (SELECT COUNT(*) FROM deck_templates WHERE author_id = auth.uid()) as template_deck_count,
    (SELECT COUNT(*) FROM card_templates WHERE author_id = auth.uid()) as template_card_count;
END;
$$;

-- Fix migrate_v1_to_v2 function
CREATE OR REPLACE FUNCTION public.migrate_v1_to_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deck record;
  v_card record;
  v_new_deck_id uuid;
  v_new_card_id uuid;
  v_decks_migrated int := 0;
  v_cards_migrated int := 0;
BEGIN
  -- Migrate each deck
  FOR v_deck IN 
    SELECT * FROM decks WHERE user_id = v_user_id
  LOOP
    -- Create deck_template
    INSERT INTO deck_templates (id, author_id, title, description, visibility, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id, v_deck.name, v_deck.description, 'private', v_deck.created_at, v_deck.updated_at)
    RETURNING id INTO v_new_deck_id;
    
    -- Create user_deck subscription
    INSERT INTO user_decks (user_id, deck_template_id, created_at)
    VALUES (v_user_id, v_new_deck_id, v_deck.created_at);
    
    v_decks_migrated := v_decks_migrated + 1;
    
    -- Migrate cards for this deck
    FOR v_card IN 
      SELECT * FROM cards WHERE deck_id = v_deck.id
    LOOP
      -- Create card_template
      INSERT INTO card_templates (
        id, deck_template_id, author_id, card_type, front, back, 
        stem, options, correct_index, explanation, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), v_new_deck_id, v_user_id, v_card.card_type, v_card.front, v_card.back,
        v_card.stem, v_card.options, v_card.correct_index, v_card.explanation, v_card.created_at, v_card.updated_at
      )
      RETURNING id INTO v_new_card_id;
      
      -- Create user_card_progress
      INSERT INTO user_card_progress (
        user_id, card_template_id, ease_factor, interval_days, repetitions,
        next_review_at, last_reviewed_at, created_at, updated_at
      )
      VALUES (
        v_user_id, v_new_card_id, v_card.ease_factor, v_card.interval_days, v_card.repetitions,
        v_card.next_review_at, v_card.last_reviewed_at, v_card.created_at, v_card.updated_at
      );
      
      v_cards_migrated := v_cards_migrated + 1;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'decks_migrated', v_decks_migrated,
    'cards_migrated', v_cards_migrated
  );
END;
$$;

-- Fix migrate_v1_to_v2_complete function
CREATE OR REPLACE FUNCTION public.migrate_v1_to_v2_complete()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- First run the migration
  v_result := migrate_v1_to_v2();
  
  -- If successful, delete legacy data
  IF (v_result->>'success')::boolean THEN
    DELETE FROM cards WHERE deck_id IN (SELECT id FROM decks WHERE user_id = v_user_id);
    DELETE FROM decks WHERE user_id = v_user_id;
    
    v_result := v_result || jsonb_build_object('legacy_data_deleted', true);
  END IF;
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- PART 6: Create extensions schema
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions';

-- ============================================================================
-- PART 7: Fix security definer view - recreate with security_invoker = true
-- ============================================================================
DROP VIEW IF EXISTS public.user_topic_accuracy;
CREATE VIEW public.user_topic_accuracy 
WITH (security_invoker = true)
AS
SELECT ucp.user_id, t.id AS tag_id, t.name AS tag_name, t.color AS tag_color,
  sum(ucp.correct_count) AS correct_count, sum(ucp.total_attempts) AS total_attempts,
  CASE WHEN sum(ucp.total_attempts) > 0 THEN sum(ucp.correct_count)::double precision / sum(ucp.total_attempts)::double precision * 100::double precision ELSE NULL::double precision END AS accuracy
FROM user_card_progress ucp
JOIN card_templates ct ON ct.id = ucp.card_template_id
JOIN card_template_tags ctt ON ctt.card_template_id = ct.id
JOIN tags t ON t.id = ctt.tag_id
WHERE t.category = 'topic'::tag_category
GROUP BY ucp.user_id, t.id, t.name, t.color;

GRANT SELECT ON public.user_topic_accuracy TO authenticated;

-- ============================================================================
-- PART 8: Consolidate multiple permissive SELECT policies
-- ============================================================================

-- deck_templates: Consolidate SELECT policies
DROP POLICY IF EXISTS "Public deck_templates readable by all" ON public.deck_templates;
DROP POLICY IF EXISTS "Authors can manage own deck_templates" ON public.deck_templates;

CREATE POLICY "deck_templates_select" ON public.deck_templates
  FOR SELECT USING (visibility = 'public' OR (select auth.uid()) = author_id);

CREATE POLICY "deck_templates_insert" ON public.deck_templates
  FOR INSERT WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "deck_templates_update" ON public.deck_templates
  FOR UPDATE USING ((select auth.uid()) = author_id) WITH CHECK ((select auth.uid()) = author_id);

CREATE POLICY "deck_templates_delete" ON public.deck_templates
  FOR DELETE USING ((select auth.uid()) = author_id);

-- card_templates: Consolidate SELECT policies
DROP POLICY IF EXISTS "Public card_templates readable by all" ON public.card_templates;
DROP POLICY IF EXISTS "Authors can manage card_templates in own decks" ON public.card_templates;

CREATE POLICY "card_templates_select" ON public.card_templates
  FOR SELECT USING (
    (select auth.uid()) = author_id
    OR EXISTS (SELECT 1 FROM deck_templates WHERE deck_templates.id = card_templates.deck_template_id AND deck_templates.visibility = 'public')
    OR EXISTS (SELECT 1 FROM deck_templates WHERE deck_templates.id = card_templates.deck_template_id AND deck_templates.author_id = (select auth.uid()))
  );

CREATE POLICY "card_templates_insert" ON public.card_templates
  FOR INSERT WITH CHECK (
    (select auth.uid()) = author_id
    OR EXISTS (SELECT 1 FROM deck_templates WHERE deck_templates.id = card_templates.deck_template_id AND deck_templates.author_id = (select auth.uid()))
  );

CREATE POLICY "card_templates_update" ON public.card_templates
  FOR UPDATE USING (
    (select auth.uid()) = author_id
    OR EXISTS (SELECT 1 FROM deck_templates WHERE deck_templates.id = card_templates.deck_template_id AND deck_templates.author_id = (select auth.uid()))
  );

CREATE POLICY "card_templates_delete" ON public.card_templates
  FOR DELETE USING (
    (select auth.uid()) = author_id
    OR EXISTS (SELECT 1 FROM deck_templates WHERE deck_templates.id = card_templates.deck_template_id AND deck_templates.author_id = (select auth.uid()))
  );

-- ============================================================================
-- REMAINING ISSUES (Cannot be fixed via migration):
-- ============================================================================
-- 1. pg_trgm extension in public schema - Requires superuser to move
--    Run in Supabase Dashboard SQL Editor:
--    DROP EXTENSION IF EXISTS pg_trgm;
--    CREATE EXTENSION pg_trgm SCHEMA extensions;
--
-- 2. Leaked password protection disabled - Auth setting, not applicable
--    since we use Google OAuth ONLY (no email/password)
--
-- 3. Unused indexes (17 INFO level) - These are expected for new features
--    not yet heavily used. Keep them for future query optimization.
