export interface Deck {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

// Card type discriminator
export type CardType = 'flashcard' | 'mcq';

export interface Card {
  id: string;
  deck_id: string;
  card_type: CardType;
  // Flashcard fields
  front: string;
  back: string;
  // MCQ fields (nullable for flashcards)
  stem: string | null;
  options: string[] | null;
  correct_index: number | null;
  explanation: string | null;
  // Shared fields
  image_url: string | null;
  interval: number;
  ease_factor: number;
  next_review: string;
  created_at: string;
  // V10.6: Digital Notebook
  is_flagged?: boolean;
  notes?: string | null;
}

// MCQ-specific card type with non-nullable MCQ fields
export interface MCQCard extends Omit<Card, 'card_type' | 'stem' | 'options' | 'correct_index'> {
  card_type: 'mcq';
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

export interface DeckWithDueCount extends Deck {
  due_count: number;
}


export interface UserStats {
  user_id: string;
  last_study_date: string | null;
  current_streak: number;
  longest_streak: number;
  total_reviews: number;
  daily_goal: number;
  created_at: string;
  updated_at: string;
}

export interface StudyLog {
  id: string;
  user_id: string;
  study_date: string;
  cards_reviewed: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Course Hierarchy Types (V2)
// ============================================

export interface Course {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
}

export interface Lesson {
  id: string;
  unit_id: string;
  title: string;
  order_index: number;
  target_item_count: number;
  created_at: string;
}

export type LessonItemType = 'mcq' | 'card';

export interface LessonItem {
  id: string;
  lesson_id: string;
  item_type: LessonItemType;
  item_id: string;
  order_index: number;
  created_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  last_completed_at: string;
  best_score: number;
  created_at: string;
}

export type LessonStatus = 'locked' | 'unlocked' | 'completed';


// ============================================
// Source Document Types (V2 - Bulk Import)
// ============================================

export interface Source {
  id: string;
  user_id: string;
  title: string;
  type: string;
  file_url: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DeckSource {
  id: string;
  deck_id: string;
  source_id: string;
  created_at: string;
}


// ============================================
// Tagging System Types (V5, V9 Ontology)
// ============================================

/**
 * V9: Tag category for 3-tier taxonomy
 * - source: Textbook/reference origin (e.g., "Williams", "Lange")
 * - topic: Medical chapter/domain (e.g., "Anatomy", "Endocrinology")
 * - concept: Specific medical concept (e.g., "Preeclampsia", "GestationalDiabetes")
 */
export type TagCategory = 'source' | 'topic' | 'concept';

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  category: TagCategory;
  created_at: string;
}

export interface CardTag {
  card_id: string;
  tag_id: string;
  created_at: string;
}

// Extended Card type with tags included
export interface CardWithTags extends Card {
  tags: Tag[];
}


// ============================================
// Shared Library Types (V6.4)
// ============================================

export type DeckVisibility = 'private' | 'public';

export interface DeckTemplate {
  id: string;
  title: string;
  description: string | null;
  visibility: DeckVisibility;
  author_id: string;
  subject?: string;  // V9.1: Medical specialty for AI prompt customization
  legacy_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardTemplate {
  id: string;
  deck_template_id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  source_meta: Record<string, unknown> | null;
  legacy_id: string | null;
  created_at: string;
}

export interface CardTemplateTag {
  card_template_id: string;
  tag_id: string;
  created_at: string;
}

export interface UserDeck {
  id: string;
  user_id: string;
  deck_template_id: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCardProgress {
  user_id: string;
  card_template_id: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: string;
  last_answered_at: string | null;
  suspended: boolean;
  // V10.2: Accuracy tracking
  correct_count: number;
  total_attempts: number;
  // V10.6: Digital Notebook
  is_flagged: boolean;
  notes: string | null;
}

// Extended CardTemplate type with tags included
export interface CardTemplateWithTags extends CardTemplate {
  tags: Tag[];
}

// Extended DeckTemplate type with due count
export interface DeckTemplateWithDueCount extends DeckTemplate {
  due_count: number;
}

// ============================================
// Library UX Types (V6.5)
// ============================================

/**
 * Deck item for the library browse view.
 * Includes visibility info and subscription status.
 */
export interface BrowseDeckItem {
  id: string;
  title: string;
  description: string | null;
  visibility: DeckVisibility;
  author_id: string;
  card_count: number;
  isSubscribed: boolean;
  isAuthor: boolean;
  created_at: string;
}

/**
 * Deck item for the My Library view.
 * Includes study statistics (due count, new count).
 */
export interface MyDeckItem {
  id: string;
  title: string;
  description: string | null;
  card_count: number;
  due_count: number;
  new_count: number;
  isAuthor: boolean;
  created_at: string;
}

// ============================================
// V10.2: Analytics Types
// ============================================

/**
 * Accuracy data for a single topic tag
 */
export interface TopicAccuracy {
  tagId: string
  tagName: string
  tagColor: string
  accuracy: number | null  // null if no attempts
  correctCount: number
  totalAttempts: number
  isLowConfidence: boolean  // true if totalAttempts < 5
}

/**
 * Progress data for a single deck
 */
export interface DeckProgress {
  deckId: string
  deckTitle: string
  cardsLearned: number  // cards with at least 1 review
  totalCards: number
}

/**
 * Daily activity data point
 */
export interface DailyActivity {
  date: string        // ISO date string (YYYY-MM-DD)
  dayName: string     // "Mon", "Tue", etc.
  cardsReviewed: number
}


// ============================================
// V11: Structured Content Engine Types
// ============================================

/**
 * Book source representing a textbook or question bank
 */
export interface BookSource {
  id: string
  author_id: string
  title: string
  edition: string | null
  specialty: string | null
  created_at: string
}

/**
 * Chapter within a book source
 */
export interface BookChapter {
  id: string
  book_source_id: string
  chapter_number: number
  title: string
  expected_question_count: number | null
  created_at: string
}

/**
 * Matching group for questions sharing common options
 */
export interface MatchingGroup {
  id: string
  chapter_id: string | null
  common_options: string[]  // JSONB array of option strings
  instruction_text: string | null
  created_at: string
}

/**
 * Extended CardTemplate with V11 structured content fields
 */
export interface CardTemplateV11 extends CardTemplate {
  book_source_id: string | null
  chapter_id: string | null
  question_number: number | null
  matching_group_id: string | null
}

/**
 * Import session context for bulk import with structured content
 */
export interface ImportSessionContext {
  bookSourceId: string | null
  chapterId: string | null
  expectedQuestionCount: number | null
  detectedQuestionNumbers: number[]
}

/**
 * Question number detection result
 */
export interface QuestionNumberDetectionResult {
  detectedNumbers: number[]
  patterns: string[]  // Which patterns were found (e.g., "1.", "1)", "Q1")
}

/**
 * Matching block detected in source text
 */
export interface MatchingBlock {
  optionLabels: string[]      // ['A', 'B', 'C', 'D', 'E']
  optionTexts: string[]       // The actual option content
  questionNumbers: number[]   // Questions that reference these options
  rawText: string            // Original text block
}
