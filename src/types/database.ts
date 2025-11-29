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
// Tagging System Types (V5)
// ============================================

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
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
