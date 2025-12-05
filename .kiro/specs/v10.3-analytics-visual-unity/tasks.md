# Implementation Plan

## Feature 1: Visual Unification (Glass Theme)

- [x] 1. Update DashboardLayout with glassmorphic styling
  - [x] 1.1 Apply consistent background and header styles
    - Update `src/app/(app)/layout.tsx` with `bg-slate-50 dark:bg-slate-900` background
    - Ensure header uses `backdrop-blur-lg` and `bg-white/80 dark:bg-slate-800/80`
    - Verify border styling matches login page (`border-white/20`)
    - _Requirements: 1.1, 1.2_

## Feature 2: Subject Badge

- [x] 2. Implement Subject Badge in header
  - [x] 2.1 Create SubjectBadge component
    - Create `src/components/navigation/SubjectBadge.tsx`
    - Implement pill-shaped badge with subtle background color
    - Accept `subject` prop with string type
    - _Requirements: 2.1, 2.4_
  - [x] 2.2 Add utility function for subject derivation
    - Add `deriveSubjectFromDecks` function to `src/lib/analytics-utils.ts`
    - Return first deck's subject or "OBGYN" as default
    - _Requirements: 2.2, 2.3_
  - [x] 2.3 Write property test for subject derivation
    - **Property 1: Subject derivation returns first deck's subject or default**
    - **Validates: Requirements 2.2, 2.3**
  - [x] 2.4 Integrate SubjectBadge into DashboardLayout header
    - Fetch user's first active deck in layout
    - Pass derived subject to SubjectBadge component
    - _Requirements: 2.1, 2.2_

## Feature 3: Radar Chart Visualization

- [x] 3. Implement TopicRadarChart component
  - [x] 3.1 Install recharts dependency
    - Run `npm install recharts`
    - Verify package.json updated
    - _Requirements: 3.1_
  - [x] 3.2 Add utility functions for radar data transformation
    - Add `getTopTopicsByAttempts` function to `src/lib/analytics-utils.ts`
    - Add `normalizeAccuracy` function for 0-100 scale
    - Add `markLowestAccuracy` function to identify lowest topic
    - _Requirements: 3.2, 3.3, 3.4_
  - [x] 3.3 Write property test for top topics selection
    - **Property 2: Top topics selection returns exactly N topics sorted by attempts**
    - **Validates: Requirements 3.2**
  - [x] 3.4 Write property test for accuracy normalization
    - **Property 3: Accuracy normalization bounds**
    - **Validates: Requirements 3.3**
  - [x] 3.5 Write property test for lowest accuracy identification
    - **Property 4: Lowest accuracy topic identification**
    - **Validates: Requirements 3.4**
  - [x] 3.6 Create TopicRadarChart component
    - Create `src/components/analytics/TopicRadarChart.tsx`
    - Use Next.js dynamic import with `{ ssr: false }`
    - Implement radar chart using recharts RadarChart component
    - Display top 5 topics by attempt count
    - Highlight lowest accuracy topic in red (#ef4444)
    - Add tooltip with topic name and accuracy percentage
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2_
  - [x] 3.7 Add loading skeleton for chart
    - Create loading placeholder while chart mounts
    - _Requirements: 5.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Feature 4: Train Weakest Topic Action

- [x] 5. Implement Train Weakest Topic functionality
  - [x] 5.1 Add utility functions for weakest topic selection
    - Add `generateTrainUrl` function to `src/lib/analytics-utils.ts`
    - Add `selectWeakestTopic` function with tie-breaker logic
    - _Requirements: 4.2, 4.3_
  - [x] 5.2 Write property test for train URL construction
    - **Property 5: Train URL construction**
    - **Validates: Requirements 4.2**
  - [x] 5.3 Write property test for tie-breaker selection
    - **Property 6: Tie-breaker selection by attempt count**
    - **Validates: Requirements 4.3**
  - [x] 5.4 Create TrainWeakestButton component
    - Create `src/components/analytics/TrainWeakestButton.tsx`
    - Display "Train Weakest Topic" button when topic available
    - Navigate to custom study session URL on click
    - Disable button and show message when no sufficient data
    - _Requirements: 4.1, 4.2, 4.4_

## Feature 5: Integration

- [x] 6. Integrate new components into Stats page
  - [x] 6.1 Update Stats page with new components
    - Import TopicRadarChart and TrainWeakestButton
    - Add radar chart section to stats page layout
    - Position TrainWeakestButton near FocusRecommendation
    - _Requirements: 3.1, 4.1_
  - [x] 6.2 Write unit tests for component integration
    - Test TopicRadarChart renders with mock data
    - Test TrainWeakestButton disabled state
    - Test navigation on button click

- [x] 7. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

