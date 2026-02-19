-- V19: Cekatan Skills Mapping
-- Creates skill_domains, deck_skill_mappings, employee_skill_scores tables
-- and adds skill_domain_id column to assessments

-- ============================================
-- 1. Skill Domains per Organization
-- ============================================
CREATE TABLE IF NOT EXISTS skill_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- ============================================
-- 2. Deck → Skill Domain Mappings
-- ============================================
CREATE TABLE IF NOT EXISTS deck_skill_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_template_id UUID NOT NULL REFERENCES deck_templates(id) ON DELETE CASCADE,
  skill_domain_id UUID NOT NULL REFERENCES skill_domains(id) ON DELETE CASCADE,
  UNIQUE(deck_template_id, skill_domain_id)
);

-- ============================================
-- 3. Employee Skill Scores (computed)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_skill_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_domain_id UUID NOT NULL REFERENCES skill_domains(id) ON DELETE CASCADE,
  score REAL,                    -- 0-100, running average
  assessments_taken INTEGER DEFAULT 0,
  last_assessed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id, skill_domain_id)
);

-- ============================================
-- 4. Link assessments to primary skill domain
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessments' AND column_name = 'skill_domain_id'
  ) THEN
    ALTER TABLE assessments ADD COLUMN skill_domain_id UUID REFERENCES skill_domains(id);
  END IF;
END $$;

-- ============================================
-- 5. Update org default settings for new orgs
-- ============================================
-- New orgs should default to assessment_mode: true, study_mode: false, skills_mapping: true
-- This is handled in application code (OrgSettings defaults), not ALTER DEFAULT here
-- to avoid overwriting existing org settings.

-- ============================================
-- 6. Row Level Security
-- ============================================

ALTER TABLE skill_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_skill_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_skill_scores ENABLE ROW LEVEL SECURITY;

-- skill_domains: org members can SELECT, admins+ can INSERT/UPDATE/DELETE
CREATE POLICY "skill_domains_select" ON skill_domains
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = skill_domains.org_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "skill_domains_insert" ON skill_domains
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = skill_domains.org_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "skill_domains_update" ON skill_domains
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = skill_domains.org_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "skill_domains_delete" ON skill_domains
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = skill_domains.org_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- deck_skill_mappings: org members with access to the deck can SELECT
CREATE POLICY "deck_skill_mappings_select" ON deck_skill_mappings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM skill_domains sd
      JOIN organization_members om ON om.org_id = sd.org_id
      WHERE sd.id = deck_skill_mappings.skill_domain_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "deck_skill_mappings_insert" ON deck_skill_mappings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM skill_domains sd
      JOIN organization_members om ON om.org_id = sd.org_id
      WHERE sd.id = deck_skill_mappings.skill_domain_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'creator')
    )
  );

CREATE POLICY "deck_skill_mappings_delete" ON deck_skill_mappings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM skill_domains sd
      JOIN organization_members om ON om.org_id = sd.org_id
      WHERE sd.id = deck_skill_mappings.skill_domain_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'creator')
    )
  );

-- employee_skill_scores: users can SELECT own scores, admins can SELECT all in org
CREATE POLICY "employee_skill_scores_select_own" ON employee_skill_scores
  FOR SELECT USING (
    user_id = auth.uid()
  );

CREATE POLICY "employee_skill_scores_select_admin" ON employee_skill_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = employee_skill_scores.org_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Service role handles INSERT/UPDATE for score computation
CREATE POLICY "employee_skill_scores_service" ON employee_skill_scores
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 7. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_skill_domains_org ON skill_domains(org_id);
CREATE INDEX IF NOT EXISTS idx_deck_skill_mappings_deck ON deck_skill_mappings(deck_template_id);
CREATE INDEX IF NOT EXISTS idx_deck_skill_mappings_skill ON deck_skill_mappings(skill_domain_id);
CREATE INDEX IF NOT EXISTS idx_employee_skill_scores_org_user ON employee_skill_scores(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_employee_skill_scores_skill ON employee_skill_scores(skill_domain_id);
CREATE INDEX IF NOT EXISTS idx_assessments_skill_domain ON assessments(skill_domain_id);
