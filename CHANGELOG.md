# Changelog

All notable changes to GamaTest will be documented in this file.

## [Unreleased]

### Renamed
- **Full rebrand from Specialize/celline-prep to GamaTest** across all production code, tests, steering rules, and seed data
- Default subject changed from "Obstetrics & Gynecology" to "General"
- localStorage key prefixes changed from `specialize:` to `gamatest:`
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
