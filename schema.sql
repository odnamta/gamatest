-- Cekatan Assessment Platform Database Schema
-- Spaced Repetition System with SM-2 Algorithm

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Decks table
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards table (supports both flashcards and MCQs)
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  -- Card type discriminator
  card_type TEXT DEFAULT 'flashcard' CHECK (card_type IN ('flashcard', 'mcq')),
  -- Flashcard fields
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  -- MCQ fields (nullable for flashcards)
  stem TEXT,
  options JSONB,
  correct_index INTEGER,
  explanation TEXT,
  -- Shared fields
  image_url TEXT,
  interval INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add MCQ fields to existing cards table
-- ALTER TABLE cards ADD COLUMN card_type TEXT DEFAULT 'flashcard' CHECK (card_type IN ('flashcard', 'mcq'));
-- ALTER TABLE cards ADD COLUMN stem TEXT;
-- ALTER TABLE cards ADD COLUMN options JSONB;
-- ALTER TABLE cards ADD COLUMN correct_index INTEGER;
-- ALTER TABLE cards ADD COLUMN explanation TEXT;

-- RLS Policies for decks
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decks" ON decks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decks" ON decks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own decks" ON decks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own decks" ON decks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for cards (via deck ownership)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cards in own decks" ON cards
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid())
  );

CREATE POLICY "Users can insert cards in own decks" ON cards
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid())
  );

CREATE POLICY "Users can update cards in own decks" ON cards
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid())
  );

CREATE POLICY "Users can delete cards in own decks" ON cards
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid())
  );

-- Performance indexes
CREATE INDEX idx_decks_user_id ON decks(user_id);
CREATE INDEX idx_cards_deck_id ON cards(deck_id);
CREATE INDEX idx_cards_next_review ON cards(next_review);


-- ============================================
-- Gamification Tables (V1)
-- ============================================

-- User stats table for streak tracking and gamification
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_study_date DATE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  daily_goal INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for user_stats
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats" ON user_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats" ON user_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON user_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Index on user_id (already PK, but explicit for clarity in queries)
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);


-- Study logs table for daily activity tracking (heatmap)
CREATE TABLE study_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date DATE NOT NULL,
  cards_reviewed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, study_date)
);

-- RLS Policies for study_logs
ALTER TABLE study_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON study_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON study_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs" ON study_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- Index on (user_id, study_date) for efficient queries
CREATE INDEX idx_study_logs_user_date ON study_logs(user_id, study_date);


-- ============================================
-- Course Hierarchy Tables (V2)
-- ============================================

-- Courses table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own courses" ON courses
  FOR ALL USING (auth.uid() = user_id);

-- Index on user_id
CREATE INDEX idx_courses_user_id ON courses(user_id);

-- Units table
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for units (via course ownership)
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage units in own courses" ON units
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = units.course_id AND courses.user_id = auth.uid())
  );

-- Index on course_id
CREATE INDEX idx_units_course_id ON units(course_id);

-- Lessons table
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  target_item_count INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for lessons (via unit/course ownership)
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage lessons in own courses" ON lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM units 
      JOIN courses ON courses.id = units.course_id 
      WHERE units.id = lessons.unit_id AND courses.user_id = auth.uid()
    )
  );

-- Index on unit_id
CREATE INDEX idx_lessons_unit_id ON lessons(unit_id);

-- Lesson items table
CREATE TABLE lesson_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('mcq', 'card')),
  item_id UUID NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for lesson_items (via lesson/unit/course ownership)
ALTER TABLE lesson_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage lesson_items in own courses" ON lesson_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN units ON units.id = lessons.unit_id
      JOIN courses ON courses.id = units.course_id
      WHERE lessons.id = lesson_items.lesson_id AND courses.user_id = auth.uid()
    )
  );

-- Index on lesson_id
CREATE INDEX idx_lesson_items_lesson_id ON lesson_items(lesson_id);

-- Lesson progress table
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  last_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  best_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- RLS Policies for lesson_progress (user ownership)
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lesson_progress" ON lesson_progress
  FOR ALL USING (auth.uid() = user_id);

-- Index on (user_id, lesson_id)
CREATE INDEX idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);


-- ============================================
-- Source Document Tables (V2 - Bulk Import)
-- ============================================

-- Sources table for PDF/document tracking
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pdf_book',
  file_url TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for sources (user ownership)
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sources" ON sources
  FOR ALL USING (auth.uid() = user_id);

-- Index on user_id
CREATE INDEX idx_sources_user_id ON sources(user_id);


-- Deck sources join table (links decks to sources)
CREATE TABLE deck_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deck_id, source_id)
);

-- RLS Policies for deck_sources (via deck ownership)
ALTER TABLE deck_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage deck_sources for own decks" ON deck_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_sources.deck_id AND decks.user_id = auth.uid())
  );

-- Index on deck_id
CREATE INDEX idx_deck_sources_deck_id ON deck_sources(deck_id);


-- ============================================
-- Tagging System Tables (V5)
-- ============================================

-- Tags table for card organization
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- RLS Policies for tags (user ownership)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tags" ON tags
  FOR ALL USING (auth.uid() = user_id);

-- Index on user_id
CREATE INDEX idx_tags_user_id ON tags(user_id);

-- V6.1: Case-insensitive unique index for tag deduplication
-- Prevents 'Anatomy' vs 'anatomy' duplicates per user
CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_lower_name_idx 
  ON tags (user_id, LOWER(name));


-- Card tags join table (links cards to tags)
CREATE TABLE card_tags (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (card_id, tag_id)
);

-- RLS Policies for card_tags (via card ownership)
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage card_tags for own cards" ON card_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM cards
      JOIN decks ON decks.id = cards.deck_id
      WHERE cards.id = card_tags.card_id AND decks.user_id = auth.uid()
    )
  );

-- Indexes for efficient filtering
CREATE INDEX idx_card_tags_card_id ON card_tags(card_id);
CREATE INDEX idx_card_tags_tag_id ON card_tags(tag_id);


-- ============================================
-- MIGRATION GUIDE: V2 Tables
-- ============================================
-- 
-- If you're getting "Could not find the table 'public.courses'" error,
-- it means the V2 tables haven't been created in your Supabase database.
-- 
-- STEP-BY-STEP INSTRUCTIONS:
-- 
-- 1. Open your Supabase Dashboard
-- 2. Go to SQL Editor
-- 3. Copy and run the following SQL blocks IN ORDER:
--
-- ============================================
-- BLOCK 1: Course Hierarchy Tables
-- ============================================
/*
-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own courses" ON courses
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);

-- Units table
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage units in own courses" ON units
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE courses.id = units.course_id AND courses.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_units_course_id ON units(course_id);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  target_item_count INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage lessons in own courses" ON lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM units 
      JOIN courses ON courses.id = units.course_id 
      WHERE units.id = lessons.unit_id AND courses.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_lessons_unit_id ON lessons(unit_id);

-- Lesson items table
CREATE TABLE IF NOT EXISTS lesson_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('mcq', 'card')),
  item_id UUID NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lesson_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage lesson_items in own courses" ON lesson_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lessons
      JOIN units ON units.id = lessons.unit_id
      JOIN courses ON courses.id = units.course_id
      WHERE lessons.id = lesson_items.lesson_id AND courses.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_lesson_items_lesson_id ON lesson_items(lesson_id);

-- Lesson progress table
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  last_completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  best_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lesson_progress" ON lesson_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);
*/

-- ============================================
-- BLOCK 2: Source Document Tables
-- ============================================
/*
-- Sources table
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pdf_book',
  file_url TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sources" ON sources
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sources_user_id ON sources(user_id);

-- Deck sources join table
CREATE TABLE IF NOT EXISTS deck_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(deck_id, source_id)
);

ALTER TABLE deck_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage deck_sources for own decks" ON deck_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_sources.deck_id AND decks.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_deck_sources_deck_id ON deck_sources(deck_id);
*/

-- ============================================
-- HOW TO RUN:
-- ============================================
-- 1. Copy BLOCK 1 (everything between the /* and */ markers)
-- 2. Paste into Supabase SQL Editor and click "Run"
-- 3. Copy BLOCK 2 and run it the same way
-- 4. Refresh your app - the error should be gone!
-- ============================================


-- ============================================
-- V6.4: Shared Library Tables
-- ============================================

-- Deck Templates (Shared Content Layer)
CREATE TABLE deck_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deck_templates_legacy_id ON deck_templates(legacy_id);
CREATE INDEX idx_deck_templates_author_id ON deck_templates(author_id);

ALTER TABLE deck_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage own deck_templates" ON deck_templates
  FOR ALL USING (auth.uid() = author_id);

CREATE POLICY "Public deck_templates readable by all" ON deck_templates
  FOR SELECT USING (visibility = 'public');


-- Card Templates (Shared Content Layer)
CREATE TABLE card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_template_id UUID NOT NULL REFERENCES deck_templates(id) ON DELETE CASCADE,
  stem TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  source_meta JSONB,
  legacy_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_card_templates_legacy_id ON card_templates(legacy_id);
CREATE INDEX idx_card_templates_deck_template_id ON card_templates(deck_template_id);

ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage card_templates in own decks" ON card_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deck_templates 
      WHERE deck_templates.id = card_templates.deck_template_id 
      AND deck_templates.author_id = auth.uid()
    )
  );

CREATE POLICY "Public card_templates readable by all" ON card_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deck_templates 
      WHERE deck_templates.id = card_templates.deck_template_id 
      AND deck_templates.visibility = 'public'
    )
  );


-- Card Template Tags (Join Table)
CREATE TABLE card_template_tags (
  card_template_id UUID NOT NULL REFERENCES card_templates(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (card_template_id, tag_id)
);

CREATE INDEX idx_card_template_tags_card_template_id ON card_template_tags(card_template_id);
CREATE INDEX idx_card_template_tags_tag_id ON card_template_tags(tag_id);

ALTER TABLE card_template_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage card_template_tags in own decks" ON card_template_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM card_templates
      JOIN deck_templates ON deck_templates.id = card_templates.deck_template_id
      WHERE card_templates.id = card_template_tags.card_template_id
      AND deck_templates.author_id = auth.uid()
    )
  );

CREATE POLICY "Public card_template_tags readable by all" ON card_template_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM card_templates
      JOIN deck_templates ON deck_templates.id = card_templates.deck_template_id
      WHERE card_templates.id = card_template_tags.card_template_id
      AND deck_templates.visibility = 'public'
    )
  );


-- User Decks (Progress Layer - Subscriptions)
CREATE TABLE user_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_template_id UUID NOT NULL REFERENCES deck_templates(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, deck_template_id)
);

CREATE INDEX idx_user_decks_user_id ON user_decks(user_id);
CREATE INDEX idx_user_decks_deck_template_id ON user_decks(deck_template_id);

ALTER TABLE user_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own user_decks" ON user_decks
  FOR ALL USING (auth.uid() = user_id);


-- User Card Progress (Progress Layer - SRS State)
CREATE TABLE user_card_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_template_id UUID NOT NULL REFERENCES card_templates(id) ON DELETE CASCADE,
  interval INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  repetitions INTEGER DEFAULT 0,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  last_answered_at TIMESTAMPTZ,
  suspended BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, card_template_id)
);

CREATE INDEX idx_user_card_progress_user_card ON user_card_progress(user_id, card_template_id);
CREATE INDEX idx_user_card_progress_user_next_review ON user_card_progress(user_id, next_review);

ALTER TABLE user_card_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own user_card_progress" ON user_card_progress
  FOR ALL USING (auth.uid() = user_id);


-- ============================================
-- V6.4: Migration Function
-- ============================================
-- Run SELECT migrate_v1_to_v2() to migrate existing data
-- The function is idempotent (safe to run multiple times)


-- ============================================
-- V9: Medical Ontology (3-Tier Taxonomy)
-- ============================================

-- Tag category enum for 3-tier taxonomy
-- - source: Textbook/reference origin (e.g., "Williams", "Lange")
-- - topic: Medical chapter/domain (e.g., "Anatomy", "Endocrinology")
-- - concept: Specific medical concept (e.g., "Preeclampsia", "GestationalDiabetes")

-- Migration: Add category enum and column
-- DO $$ BEGIN
--   CREATE TYPE tag_category AS ENUM ('source', 'topic', 'concept');
-- EXCEPTION
--   WHEN duplicate_object THEN null;
-- END $$;
-- 
-- ALTER TABLE tags ADD COLUMN IF NOT EXISTS category tag_category NOT NULL DEFAULT 'concept';
-- UPDATE tags SET category = 'concept' WHERE category IS NULL;
-- CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- Category-to-Color Mapping (enforced by application):
-- source → blue
-- topic → purple
-- concept → green
