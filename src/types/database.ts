// ============================================
// Organization Types (V13 - Multi-Tenant)
// ============================================

export type OrgRole = 'owner' | 'admin' | 'creator' | 'candidate';

/**
 * Feature flags configurable per organization.
 * Controls which platform capabilities are available.
 */
export interface OrgFeatures {
  study_mode: boolean
  assessment_mode: boolean
  proctoring: boolean
  certification: boolean
  ai_generation: boolean
  pdf_extraction: boolean
  flashcards: boolean
  erp_integration: boolean
}

export interface OrgBranding {
  primary_color: string
}

export interface AssessmentDefaults {
  time_limit_minutes: number
  pass_score: number
  shuffle_questions: boolean
  shuffle_options: boolean
  show_results: boolean
  allow_review: boolean
}

export interface OrgSettings {
  features: OrgFeatures
  branding: OrgBranding
  default_language: string
  assessment_defaults?: AssessmentDefaults
}

export interface Organization {
  id: string
  name: string
  slug: string
  settings: OrgSettings
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  joined_at: string
}

/**
 * Organization member enriched with profile data
 */
export interface OrganizationMemberWithProfile extends OrganizationMember {
  email: string
  full_name: string | null
}

/**
 * Organization with member count for admin views
 */
export interface OrganizationWithMemberCount extends Organization {
  member_count: number
}

// ============================================
// Profile Types (V13 - User Profiles)
// ============================================

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Invitation Types (V13 - Member Invitations)
// ============================================

export interface Invitation {
  id: string
  org_id: string
  email: string
  role: OrgRole
  invited_by: string
  token: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

// ============================================
// Audit Log Types (V16 - Admin Intelligence)
// ============================================

export type AuditAction =
  | 'assessment.published'
  | 'assessment.archived'
  | 'assessment.deleted'
  | 'assessment.created'
  | 'assessment.unpublished'
  | 'candidate.attempts_reset'
  | 'candidate.imported'
  | 'member.invited'
  | 'member.removed'
  | 'member.role_changed'
  | 'member.joined'
  | 'settings.updated'
  | 'notification.sent'

export interface AuditLog {
  id: string
  org_id: string
  actor_id: string
  action: AuditAction
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLogWithActor extends AuditLog {
  actor_email: string
  actor_name: string | null
}

// ============================================
// Assessment Types (V13 - Assessment Engine)
// ============================================

export type AssessmentStatus = 'draft' | 'published' | 'archived'
export type SessionStatus = 'in_progress' | 'completed' | 'timed_out'

export interface Assessment {
  id: string
  org_id: string
  deck_template_id: string
  title: string
  description: string | null
  time_limit_minutes: number
  pass_score: number
  question_count: number
  shuffle_questions: boolean
  shuffle_options: boolean
  show_results: boolean
  max_attempts: number | null
  cooldown_minutes: number | null
  allow_review: boolean
  start_date: string | null
  end_date: string | null
  access_code: string | null
  status: AssessmentStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface TabSwitchEntry {
  timestamp: string
  type: 'tab_hidden' | 'tab_visible'
}

export interface AssessmentSession {
  id: string
  assessment_id: string
  user_id: string
  started_at: string
  completed_at: string | null
  time_remaining_seconds: number | null
  score: number | null
  passed: boolean | null
  question_order: string[] // card_template_ids
  status: SessionStatus
  tab_switch_count: number
  tab_switch_log: TabSwitchEntry[]
  ip_address: string | null
  created_at: string
}

export interface AssessmentAnswer {
  id: string
  session_id: string
  card_template_id: string
  selected_index: number | null
  is_correct: boolean | null
  answered_at: string | null
  time_spent_seconds: number | null
}

/**
 * Assessment template config (stored as JSONB)
 */
export interface AssessmentTemplateConfig {
  time_limit_minutes: number
  pass_score: number
  question_count: number
  shuffle_questions: boolean
  shuffle_options: boolean
  show_results: boolean
  max_attempts: number | null
  cooldown_minutes: number | null
  allow_review: boolean
}

export interface AssessmentTemplate {
  id: string
  org_id: string
  name: string
  description: string | null
  config: AssessmentTemplateConfig
  created_by: string
  created_at: string
  updated_at: string
}

/**
 * Assessment with deck info for list views
 */
export interface AssessmentWithDeck extends Assessment {
  deck_title: string
  session_count: number
}

/**
 * Session with score for results views
 */
export interface SessionWithAssessment extends AssessmentSession {
  assessment_title: string
  total_questions: number
}

// ============================================
// Legacy Types (V1 — DO NOT USE for new code)
// ============================================

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
  org_id: string | null;  // V13: Organization scope (null during migration)
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
  org_id: string | null;  // V13: Organization scope (null during migration)
  subject?: string;  // V9.1: Specialty for AI prompt customization
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
  // V11.3: Card status for draft/publish workflow
  status?: 'draft' | 'published' | 'archived';
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
  org_id: string | null  // V13: Organization scope (null during migration)
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
