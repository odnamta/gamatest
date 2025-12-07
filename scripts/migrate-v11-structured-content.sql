-- V11: Structured Content Engine Migration
-- Adds book_sources, book_chapters, matching_groups tables
-- Extends card_templates with structured content foreign keys

-- ============================================
-- 1. Book Sources Table
-- ============================================

CREATE TABLE IF NOT EXISTS book_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  edition TEXT,
  specialty TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for author queries
CREATE INDEX IF NOT EXISTS idx_book_sources_author_id ON book_sources(author_id);

-- RLS for book_sources
ALTER TABLE book_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage own book_sources" ON book_sources
  FOR ALL USING (auth.uid() = author_id);

COMMENT ON TABLE book_sources IS 'V11: Textbook/question bank metadata for structured content organization';

-- ============================================
-- 2. Book Chapters Table
-- ============================================

CREATE TABLE IF NOT EXISTS book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_source_id UUID NOT NULL REFERENCES book_sources(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  expected_question_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_source_id, chapter_number)
);

-- Index for book queries
CREATE INDEX IF NOT EXISTS idx_book_chapters_book_source_id ON book_chapters(book_source_id);

-- RLS for book_chapters (via book_sources ownership)
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage chapters in own books" ON book_chapters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM book_sources 
      WHERE book_sources.id = book_chapters.book_source_id 
      AND book_sources.author_id = auth.uid()
    )
  );

COMMENT ON TABLE book_chapters IS 'V11: Chapter hierarchy within book sources';


-- ============================================
-- 3. Matching Groups Table
-- ============================================

CREATE TABLE IF NOT EXISTS matching_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE SET NULL,
  common_options JSONB NOT NULL,
  instruction_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for chapter queries
CREATE INDEX IF NOT EXISTS idx_matching_groups_chapter_id ON matching_groups(chapter_id);

-- RLS for matching_groups (via chapter/book ownership, allow null chapter_id)
ALTER TABLE matching_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage matching_groups via chapter" ON matching_groups
  FOR ALL USING (
    chapter_id IS NULL OR EXISTS (
      SELECT 1 FROM book_chapters
      JOIN book_sources ON book_sources.id = book_chapters.book_source_id
      WHERE book_chapters.id = matching_groups.chapter_id
      AND book_sources.author_id = auth.uid()
    )
  );

COMMENT ON TABLE matching_groups IS 'V11: Shared options for matching-style questions';

-- ============================================
-- 4. Extend card_templates Table
-- ============================================

-- Add nullable foreign key columns
ALTER TABLE card_templates
ADD COLUMN IF NOT EXISTS book_source_id UUID REFERENCES book_sources(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES book_chapters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS question_number INTEGER,
ADD COLUMN IF NOT EXISTS matching_group_id UUID REFERENCES matching_groups(id) ON DELETE SET NULL;

-- Indexes for new FK columns
CREATE INDEX IF NOT EXISTS idx_card_templates_book_source_id ON card_templates(book_source_id);
CREATE INDEX IF NOT EXISTS idx_card_templates_chapter_id ON card_templates(chapter_id);
CREATE INDEX IF NOT EXISTS idx_card_templates_matching_group_id ON card_templates(matching_group_id);

-- Comments for documentation
COMMENT ON COLUMN card_templates.book_source_id IS 'V11: Reference to source textbook/question bank';
COMMENT ON COLUMN card_templates.chapter_id IS 'V11: Reference to chapter within book source';
COMMENT ON COLUMN card_templates.question_number IS 'V11: Original question number from source material';
COMMENT ON COLUMN card_templates.matching_group_id IS 'V11: Reference to matching group for shared options';
