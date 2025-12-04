# Requirements Document

## Introduction

V9.6: The Tag Consolidator introduces AI-powered tag analysis to automatically identify and suggest merges for typos, synonyms, and casing inconsistencies in the tag list. This feature saves administrators from manual cleanup by leveraging OpenAI to analyze the entire tag corpus and propose intelligent consolidation groups.

## Glossary

- **Tag Consolidator**: The system that analyzes tags and suggests merge groups
- **Merge Group**: A set of tags identified as duplicates/synonyms, with one designated as the master
- **Master Tag**: The canonical tag that variations should be merged into
- **Variation**: A tag identified as a typo, synonym, or casing variant of a master tag
- **Smart Cleanup**: The admin UI tab for reviewing and approving AI-suggested merges

## Requirements

### Requirement 1: AI Tag Analysis

**User Story:** As an admin, I want the system to analyze all my tags using AI, so that I can identify typos, synonyms, and casing issues without manual review.

#### Acceptance Criteria

1. WHEN an admin triggers tag analysis THEN the Tag Consolidator SHALL fetch all tag names from the database and send them to OpenAI for analysis
2. WHEN the tag list contains fewer than 200 tags THEN the Tag Consolidator SHALL process all tags in a single API call
3. WHEN the tag list contains 200 or more tags THEN the Tag Consolidator SHALL batch tags into groups of 100 for processing
4. WHEN OpenAI returns merge suggestions THEN the Tag Consolidator SHALL parse the JSON response into structured merge groups
5. WHEN a suggested master tag matches an existing tag name (case-insensitive) THEN the Tag Consolidator SHALL prefer the existing tag's ID as the merge target

### Requirement 2: Merge Suggestion Data Model

**User Story:** As a developer, I want a clear data structure for merge suggestions, so that the UI can render and process them consistently.

#### Acceptance Criteria

1. WHEN the AI returns suggestions THEN the Tag Consolidator SHALL structure each group with a master tag name and an array of variation tag names
2. WHEN mapping suggestions to database entities THEN the Tag Consolidator SHALL resolve tag names to their corresponding tag IDs
3. WHEN a suggested variation does not exist in the database THEN the Tag Consolidator SHALL exclude it from the merge group

### Requirement 3: Smart Cleanup UI

**User Story:** As an admin, I want a dedicated UI tab to review AI-suggested merges, so that I can approve or reject consolidation proposals before they take effect.

#### Acceptance Criteria

1. WHEN an admin navigates to the Tag Manager THEN the system SHALL display a "Smart Cleanup" tab alongside existing functionality
2. WHEN the Smart Cleanup tab is active THEN the system SHALL show an "Analyze Tags" button to trigger AI analysis
3. WHEN analysis completes THEN the system SHALL render a list of proposed merge groups with checkboxes
4. WHEN displaying a merge group THEN the system SHALL show the master tag prominently and list all variations beneath it
5. WHEN no merge suggestions exist THEN the system SHALL display a message indicating all tags are clean

### Requirement 4: Batch Merge Execution

**User Story:** As an admin, I want to approve multiple merge groups at once, so that I can efficiently clean up my tag list.

#### Acceptance Criteria

1. WHEN an admin selects one or more merge groups THEN the system SHALL enable an "Approve Selected" button
2. WHEN the admin clicks "Approve Selected" THEN the system SHALL execute merges for all selected groups using the existing `mergeMultipleTags` action
3. WHEN a merge group is processed THEN the system SHALL transfer all card associations from variations to the master tag
4. WHEN all selected merges complete THEN the system SHALL refresh the tag list and clear the suggestions
5. WHEN a merge fails THEN the system SHALL display an error message and continue processing remaining groups

