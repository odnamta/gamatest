import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const createDeckSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
});

export const createCardSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  front: z.string().min(1, 'Front content is required'),
  back: z.string().min(1, 'Back content is required'),
  imageUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

export const ratingSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export const createMCQSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  stem: z.string().min(1, 'Question stem is required'),
  options: z.array(z.string().min(1, 'Option cannot be empty')).min(2, 'At least 2 options required'),
  correctIndex: z.number().int('Correct index must be an integer').min(0, 'Correct index must be non-negative'),
  explanation: z.string().optional(),
  imageUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
}).refine(
  (data) => data.correctIndex < data.options.length,
  { message: 'Correct index must be within options bounds', path: ['correctIndex'] }
);

// ============================================
// Course Hierarchy Validation Schemas (V2)
// ============================================

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
});

export const updateCourseSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').optional(),
});

export const createUnitSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  orderIndex: z.number().int().min(0).optional(),
});

export const updateUnitSchema = z.object({
  unitId: z.string().uuid('Invalid unit ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export const createLessonSchema = z.object({
  unitId: z.string().uuid('Invalid unit ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  orderIndex: z.number().int().min(0).optional(),
  targetItemCount: z.number().int().min(1).max(100).optional(),
});

export const updateLessonSchema = z.object({
  lessonId: z.string().uuid('Invalid lesson ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  orderIndex: z.number().int().min(0).optional(),
  targetItemCount: z.number().int().min(1).max(100).optional(),
});

export const addLessonItemSchema = z.object({
  lessonId: z.string().uuid('Invalid lesson ID'),
  itemType: z.enum(['mcq', 'card']),
  itemId: z.string().uuid('Invalid item ID'),
  orderIndex: z.number().int().min(0).optional(),
});

export const reorderLessonItemsSchema = z.object({
  lessonId: z.string().uuid('Invalid lesson ID'),
  itemIds: z.array(z.string().uuid('Invalid item ID')).min(1, 'At least one item required'),
});

// ============================================
// Organization Validation Schemas (V13)
// ============================================

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'callback', 'dashboard', 'decks', 'help',
  'invite', 'join', 'library', 'login', 'logout', 'notifications', 'orgs',
  'privacy', 'profile', 'settings', 'signup', 'stats', 'study', 'support',
  'terms', 'www',
])

export const createOrgSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug too long')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be lowercase alphanumeric with hyphens, cannot start or end with hyphen')
    .refine((s) => !RESERVED_SLUGS.has(s), 'This slug is reserved and cannot be used'),
});

export const updateOrgSettingsSchema = z.object({
  orgId: z.string().uuid('Invalid org ID'),
  name: z.string().min(1).max(100).optional(),
  settings: z.object({
    features: z.object({
      study_mode: z.boolean(),
      assessment_mode: z.boolean(),
      proctoring: z.boolean(),
      certification: z.boolean(),
      ai_generation: z.boolean(),
      pdf_extraction: z.boolean(),
      flashcards: z.boolean(),
      erp_integration: z.boolean(),
    }).partial().optional(),
    branding: z.object({
      primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #1e40af)'),
      logo_url: z.string().url().or(z.literal('')),
    }).partial().optional(),
    default_language: z.string().optional(),
  }).optional(),
});

export const inviteMemberSchema = z.object({
  orgId: z.string().uuid('Invalid org ID'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'creator', 'candidate']),
});

// ============================================
// Assessment Validation Schemas (V13)
// ============================================

export const createAssessmentSchema = z.object({
  deckTemplateId: z.string().uuid('Invalid deck ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  timeLimitMinutes: z.number().int().min(1, 'Minimum 1 minute').max(480, 'Maximum 8 hours'),
  passScore: z.number().int().min(0).max(100, 'Pass score must be 0-100'),
  questionCount: z.number().int().min(1, 'At least 1 question').max(500, 'Maximum 500 questions'),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(false),
  showResults: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).optional(),
});

export const updateAssessmentSchema = z.object({
  assessmentId: z.string().uuid('Invalid assessment ID'),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  timeLimitMinutes: z.number().int().min(1).max(480).optional(),
  passScore: z.number().int().min(0).max(100).optional(),
  questionCount: z.number().int().min(1).max(500).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showResults: z.boolean().optional(),
  maxAttempts: z.number().int().min(1).nullable().optional(),
  cooldownMinutes: z.number().int().min(0).nullable().optional(),
  allowReview: z.boolean().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  accessCode: z.string().max(50).nullable().optional(),
});

export const submitAnswerSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  cardTemplateId: z.string().uuid('Invalid card ID'),
  selectedIndex: z.number().int().min(0),
});

// Export types inferred from schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateDeckInput = z.infer<typeof createDeckSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type RatingInput = z.infer<typeof ratingSchema>;
export type CreateMCQInput = z.infer<typeof createMCQSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type AddLessonItemInput = z.infer<typeof addLessonItemSchema>;
export type ReorderLessonItemsInput = z.infer<typeof reorderLessonItemsSchema>;
export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
