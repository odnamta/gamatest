# Changelog

All notable changes to Cekatan will be documented in this file.

## [v20] - RLS Policy Fixes

### Fixed
- **Organization deletion**: Added owner-only DELETE policy; removed premature member deletion that broke RLS check
- **Notification delivery**: Switched 5 notification insert functions to service role client (cross-user inserts blocked by RLS)
- **Invitation acceptance**: Switched `acceptInvitation()` to service role client for invitation lookup and status updates
- **Assessment template updates**: Added UPDATE policy for creators and org admins/owners
- **Matching groups data leak**: Replaced permissive policy (`chapter_id IS NULL` gave any user full access) with ownership-traced policy via book_chapters and card_templates

### Added
- DB migration: `scripts/migrate-v20-rls-fixes.sql` — 3 new/replaced RLS policies

### Chore
- Gitignored `public/sw.js` and `public/workbox-*.js` (next-pwa build artifacts)

## [v19.1] - Role-Based Competency Framework

### Added
- **Role Profiles**: Define positions (e.g., Operator Forklift, Supervisor Gudang) with skill requirements
- **Skill Requirements**: Set target scores (0-100) and priority (Wajib/Disarankan/Opsional) per role
- **Employee Role Assignments**: Assign employees to roles, track gap analysis
- **Role Gap Radar**: Recharts radar chart showing target vs actual scores per role
- **Role detail page** (`/skills/roles/[id]`): Inline-editable skill requirements, employee assignment
- **MySkillProfile widget**: Expanded with role gap analysis section on dashboard
- Tabbed Skills page: Skill Domains | Role Profiles
- Role profile card with skill count and employee count badges
- 9 GIS role profiles and 7 GLS role profiles seeded with requirements
- DB migration: `role_profiles`, `role_skill_requirements`, `employee_role_assignments` tables with RLS

## [v19] - Cekatan Rebrand + Skills Mapping

### Renamed
- **Full rebrand from GamaTest to Cekatan** — platform name, metadata, landing page, onboarding, all UI
- Removed all medical/OBGYN language from codebase (onboarding, AI prompts, tags, subjects, profile)
- AI prompts now use dynamic deck subject + org name instead of hardcoded specialties
- Onboarding simplified: 1-step name confirmation (was 3-step with specialty + exam date)

### Added
- **Employee Skills Mapping** (`/skills`): Create skill domains per org, link decks to skills
- **Skill Radar Chart**: Recharts radar chart for employee skill profiles
- **Skill Heatmap**: Admin view of employees × skills matrix, color-coded by score
- **Assessment → Skill pipeline**: Completing assessments auto-updates employee skill scores (running average)
- Service role Supabase client for secure system-level score calculations
- Skills nav link (desktop + mobile), conditional on `skills_mapping` feature flag
- Assessment-first defaults: new orgs get `assessment_mode: true`, `study_mode: false`, `skills_mapping: true`
- GIS expanded to 15 skill domains, GLS to 12 skill domains
- DB migration: `skill_domains`, `deck_skill_mappings`, `employee_skill_scores` tables with RLS

### Changed
- Profile page: Briefcase icon (was stethoscope), Department text field (was specialty dropdown)
- Tags: Generic categories (General, Safety, Operations, etc.) replace medical ones
- Subjects: Generic list replaces medical specialties
- Book source placeholder: "e.g., Safety Training Manual" (was "Williams Obstetrics")

## [Unreleased]

### Renamed
- **Full rebrand from Specialize/celline-prep to GamaTest, then to Cekatan** across all production code, tests, steering rules, and seed data
- Default subject changed from "Obstetrics & Gynecology" to "General"
- localStorage key prefixes changed from `specialize:` to `gamatest:` to `cekatan:`
- Terms of Service updated to reflect domain-agnostic platform

### Fixed
- Resolved 21 TypeScript compilation errors in test files (missing `org_id` on Tag type, type mismatches, unused directives)

### Added
- Multi-tenant seed script with two organizations:
  - **PT. Gama Intisamudera (GIS)**: Heavy Equipment Safety, Logistics Operations Basics, Customer Service Skills
  - **PT. Gama Lintas Samudera (GLS)**: Freight Forwarding Fundamentals, Sales Aptitude Assessment, International Trade Compliance

## [v12] - Quality Scanner & Unified MCQ Editor

### Added
- Quality Scanner for identifying content issues in card templates
- Unified MCQ Editor with inline editing capabilities

## [v11.7] - Companion Dashboard & Tag-Filtered Global Study

### Added
- Companion-style dashboard with study insights
- Tag-filtered global study sessions
- Tag-based filtering across all decks

## [v11.6] - Bulk Import Reliability

### Added
- Drafts workspace for staging imported content
- Duplicate protection during bulk import
- Bulk publish/archive workflow for draft cards
