# Requirements Document

## Introduction

V10.3 "Analytics & Visual Unity" builds upon the Weakness Hunter foundation from V10.2 by introducing two key improvements: (1) Visual unification that applies the glassmorphic design language from the login page to the main dashboard layout, creating a cohesive aesthetic across the application, and (2) Enhanced analytics visualization with a Radar Chart that displays topic strengths at a glance, plus an actionable "Train Weakest Topic" button for immediate remediation.

## Glossary

- **Glassmorphism**: A design style featuring frosted-glass effects using backdrop blur, semi-transparent backgrounds, and subtle borders
- **Radar Chart**: A spider/web chart displaying multiple variables (topics) as axes radiating from a center point, useful for comparing performance across categories
- **Subject Badge**: A visual indicator in the header showing the user's current medical specialty (e.g., "Obstetrics & Gynecology")
- **Topic Accuracy**: The percentage of correct answers for cards tagged with a specific topic
- **Mastery Percentage**: Cards with interval > 3 days divided by total cards, indicating long-term retention
- **Custom Session**: A study session filtered by specific criteria such as tag ID

## Requirements

### Requirement 1

**User Story:** As a user, I want the dashboard to have the same visual style as the login page, so that the application feels cohesive and polished.

#### Acceptance Criteria

1. WHEN the DashboardLayout renders THEN the System SHALL apply `bg-slate-50 dark:bg-slate-900` background styling consistent with the login page
2. WHEN the header is rendered THEN the System SHALL apply `backdrop-blur-lg` and semi-transparent background (`bg-white/80 dark:bg-slate-800/80`) for glassmorphic effect
3. WHEN buttons are rendered in the dashboard THEN the System SHALL use consistent styling with the login page button components
4. WHEN fonts are rendered THEN the System SHALL use the Geist font family consistently across login and dashboard

### Requirement 2

**User Story:** As a user, I want to see my current medical specialty displayed in the header, so that I know which subject context I'm studying in.

#### Acceptance Criteria

1. WHEN the header renders THEN the System SHALL display a Subject Badge showing the current specialty
2. WHEN the user has subscribed decks THEN the System SHALL derive the subject from the user's first active deck template
3. WHEN the user has no subscribed decks THEN the System SHALL display "OBGYN" as the default subject
4. WHEN the Subject Badge is displayed THEN the System SHALL use a pill-shaped design with subtle background color

### Requirement 3

**User Story:** As a user, I want to see a radar chart of my topic performance, so that I can visualize my strengths and weaknesses across all subjects at a glance.

#### Acceptance Criteria

1. WHEN the TopicRadarChart component renders THEN the System SHALL display a spider/radar graph using the recharts library
2. WHEN displaying topic data THEN the System SHALL show the top 5 topics by attempt count on the radar axes
3. WHEN rendering accuracy values THEN the System SHALL normalize data to a 0-100 scale on the radar
4. WHEN a topic has the lowest accuracy score THEN the System SHALL highlight that data point in red (#ef4444)
5. WHEN hovering over a radar data point THEN the System SHALL display a tooltip with the topic name and exact accuracy percentage
6. WHEN the component is rendered on the server THEN the System SHALL use dynamic import with `ssr: false` to prevent hydration errors

### Requirement 4

**User Story:** As a user, I want to quickly start a study session focused on my weakest topic, so that I can efficiently improve my knowledge gaps.

#### Acceptance Criteria

1. WHEN the analytics dashboard displays a weakest topic THEN the System SHALL show a "Train Weakest Topic" button
2. WHEN the user clicks "Train Weakest Topic" THEN the System SHALL navigate to `/study/custom?tagIds={tagId}&mode=due`
3. WHEN multiple topics share the lowest accuracy THEN the System SHALL select the topic with the highest attempt count for training
4. WHEN no topics have sufficient data (fewer than 5 attempts) THEN the System SHALL disable the button and display an encouraging message

### Requirement 5

**User Story:** As a developer, I want the radar chart to render without hydration errors, so that the application works reliably in Next.js.

#### Acceptance Criteria

1. WHEN importing the recharts library THEN the System SHALL use Next.js dynamic import with `{ ssr: false }` option
2. WHEN the chart component mounts THEN the System SHALL render only on the client side
3. WHEN the chart data is loading THEN the System SHALL display a loading skeleton placeholder

