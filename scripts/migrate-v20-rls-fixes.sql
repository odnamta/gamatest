-- Migration V20: RLS Policy Fixes
-- Fixes 5 identified RLS policy gaps causing silent failures.
-- Date: 2026-02-19

BEGIN;

-- =============================================================================
-- Fix 1: organizations DELETE policy (HIGH)
-- Owner-only delete. The deleteOrganization() code fix removes manual member
-- deletion so the owner row still exists when this policy checks.
-- =============================================================================
CREATE POLICY "org_delete" ON organizations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = organizations.id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'owner'
    )
  );

-- =============================================================================
-- Fix 4: assessment_templates UPDATE policy (MEDIUM)
-- Creators can update own templates; admins/owners can update any in their org.
-- =============================================================================
CREATE POLICY "Creators can update own templates"
  ON assessment_templates FOR UPDATE
  USING (
    assessment_templates.created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = assessment_templates.org_id
        AND organization_members.user_id = (SELECT auth.uid())
        AND organization_members.role IN ('admin', 'owner')
    )
  );

-- =============================================================================
-- Fix 5: matching_groups overly permissive policy (HIGH)
-- The old policy's `chapter_id IS NULL` clause gives any user full access.
-- Replace with a tighter policy that traces ownership through book_chapters
-- and card_templates.
-- =============================================================================
DROP POLICY IF EXISTS "Authors can manage matching_groups via chapter" ON matching_groups;

CREATE POLICY "matching_groups_author_access" ON matching_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM book_chapters
      JOIN book_sources ON book_sources.id = book_chapters.book_source_id
      WHERE book_chapters.id = matching_groups.chapter_id
      AND book_sources.author_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM card_templates ct
      JOIN deck_templates dt ON dt.id = ct.deck_template_id
      WHERE ct.matching_group_id = matching_groups.id
      AND dt.author_id = (SELECT auth.uid())
    )
  );

-- =============================================================================
-- Fixes 2 & 3 (notifications INSERT, invitations SELECT/UPDATE) are handled
-- in application code by switching to the service role client, which bypasses
-- RLS. No SQL policy changes needed for those.
-- =============================================================================

COMMIT;
