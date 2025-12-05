# Design Document: V10.3 Analytics & Visual Unity

## Overview

V10.3 enhances the application with two complementary improvements: visual unification that brings the glassmorphic design language from the login page to the dashboard, and enhanced analytics visualization with a Radar Chart for topic performance. This creates a cohesive user experience while providing actionable insights for targeted study.

## Architecture

### Component Hierarchy

```
AppLayout (Server Component)
├── Header
│   ├── Logo
│   ├── Navigation
│   ├── SubjectBadge (New)
│   └── UserActions
├── Main Content
│   └── StatsPage
│       ├── FocusRecommendation (Existing)
│       ├── TopicRadarChart (New - Client)
│       ├── ActivityBarChart (Existing)
│       └── TrainWeakestButton (New)
└── MobileNavBar
```

### Data Flow

```mermaid
flowchart TD
    A[getUserAnalytics Action] --> B[topicAccuracies]
    B --> C[getTopFiveTopics]
    C --> D[TopicRadarChart]
    B --> E[findWeakestTopic]
    E --> F[TrainWeakestButton]
    F --> G[/study/custom?tagIds=X]
    
    H[getUserSubject Action] --> I[SubjectBadge]
```

## Components and Interfaces

### SubjectBadge Component

```typescript
// src/components/navigation/SubjectBadge.tsx
interface SubjectBadgeProps {
  subject: string
}

export function SubjectBadge({ subject }: SubjectBadgeProps)
```

Server component that displays the current medical specialty in a pill-shaped badge.

### TopicRadarChart Component

```typescript
// src/components/analytics/TopicRadarChart.tsx
interface RadarDataPoint {
  topic: string
  accuracy: number
  fullMark: 100
  isLowest: boolean
}

interface TopicRadarChartProps {
  topics: TopicAccuracy[]
}

export function TopicRadarChart({ topics }: TopicRadarChartProps)
```

Client-only component using recharts. Must be dynamically imported with `ssr: false`.

### TrainWeakestButton Component

```typescript
// src/components/analytics/TrainWeakestButton.tsx
interface TrainWeakestButtonProps {
  topic: TopicAccuracy | null
  disabled?: boolean
}

export function TrainWeakestButton({ topic, disabled }: TrainWeakestButtonProps)
```

### Utility Functions

```typescript
// src/lib/analytics-utils.ts (additions)

/**
 * Selects top N topics by attempt count for radar display
 */
export function getTopTopicsByAttempts(
  topics: TopicAccuracy[],
  count: number
): TopicAccuracy[]

/**
 * Generates the training URL for a topic
 */
export function generateTrainUrl(tagId: string): string

/**
 * Selects the weakest topic, using attempt count as tie-breaker
 */
export function selectWeakestTopic(topics: TopicAccuracy[]): TopicAccuracy | null

/**
 * Derives subject name from user's first active deck
 */
export function deriveSubjectFromDecks(
  decks: Array<{ title: string }>,
  defaultSubject?: string
): string
```

## Data Models

### Existing Types (from v10.2)

```typescript
// src/types/database.ts
interface TopicAccuracy {
  tagId: string
  tagName: string
  tagColor: string
  accuracy: number | null
  correctCount: number
  totalAttempts: number
  isLowConfidence: boolean
}
```

### New Types

```typescript
// src/types/analytics.ts
interface RadarChartData {
  topic: string
  accuracy: number
  fullMark: 100
  isLowest: boolean
}

interface SubjectInfo {
  name: string
  isDefault: boolean
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Subject derivation returns first deck's subject or default

*For any* list of user decks (including empty), the derived subject should equal the first deck's title-derived subject when decks exist, or "OBGYN" when the list is empty.

**Validates: Requirements 2.2, 2.3**

### Property 2: Top topics selection returns exactly N topics sorted by attempts

*For any* list of topic accuracies with length >= N, `getTopTopicsByAttempts(topics, N)` should return exactly N topics, and those N topics should have the highest attempt counts from the input list.

**Validates: Requirements 3.2**

### Property 3: Accuracy normalization bounds

*For any* accuracy value (including null), the normalized value for radar display should be between 0 and 100 inclusive, with null values mapped to 0.

**Validates: Requirements 3.3**

### Property 4: Lowest accuracy topic identification

*For any* non-empty list of topic accuracies, the topic marked as `isLowest` should have an accuracy less than or equal to all other topics in the list.

**Validates: Requirements 3.4**

### Property 5: Train URL construction

*For any* valid UUID tag ID, `generateTrainUrl(tagId)` should return a URL matching the pattern `/study/custom?tagIds={tagId}&mode=due`.

**Validates: Requirements 4.2**

### Property 6: Tie-breaker selection by attempt count

*For any* list of topics where multiple topics share the minimum accuracy, `selectWeakestTopic` should return the topic with the highest `totalAttempts` among those tied topics.

**Validates: Requirements 4.3**

## Error Handling

| Scenario | Handling |
|----------|----------|
| No topic data available | Display encouraging message, disable Train button |
| Recharts hydration error | Use dynamic import with `ssr: false` |
| User has no subscribed decks | Default subject to "OBGYN" |
| Topic accuracy is null | Treat as 0% for comparison, display "N/A" |
| Fewer than 5 topics | Display all available topics on radar |

## Testing Strategy

### Property-Based Testing

Use **fast-check** library for property-based tests. Each property test should run a minimum of 100 iterations.

Property tests will be located in `src/__tests__/analytics-v10.3.property.test.ts`.

Each test must be tagged with the format: `**Feature: v10.3-analytics-visual-unity, Property {number}: {property_text}**`

### Unit Tests

Unit tests cover specific examples and edge cases:

- SubjectBadge renders with provided subject
- SubjectBadge renders default "OBGYN" when no subject provided
- TopicRadarChart renders loading skeleton initially
- TrainWeakestButton is disabled when topic is null
- TrainWeakestButton navigates to correct URL on click

### Integration Points

- Verify recharts renders without hydration errors
- Verify dynamic import works correctly in Next.js
- Verify navigation to custom study session works

