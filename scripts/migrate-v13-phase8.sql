-- ============================================
-- V13 Phase 8: Assessment Hardening
-- ============================================
-- Adds cooldown_minutes and allow_review to assessments.

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS cooldown_minutes INT,
  ADD COLUMN IF NOT EXISTS allow_review BOOLEAN NOT NULL DEFAULT true;
