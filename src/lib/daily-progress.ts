/**
 * Daily Progress Computation
 * Pure function for calculating cards completed today.
 * Requirements: 1.3, 1.4
 * 
 * Feature: v3-ux-overhaul
 */

/**
 * Computes the daily progress (cards reviewed today) from a study log.
 * Returns 0 if no study log exists for today.
 * 
 * @param studyLog - Study log entry for today, or null if none exists
 * @returns Number of cards reviewed today
 */
export function computeDailyProgress(
  studyLog: { cards_reviewed: number } | null
): number {
  if (!studyLog) {
    return 0
  }
  return studyLog.cards_reviewed
}

/**
 * Computes the progress percentage toward a daily goal.
 * Returns null if no daily goal is set.
 * 
 * @param completedToday - Number of cards completed today
 * @param dailyGoal - Daily goal target, or null if not set
 * @returns Progress percentage (0-100), capped at 100, or null if no goal
 */
export function computeProgressPercent(
  completedToday: number,
  dailyGoal: number | null
): number | null {
  if (dailyGoal === null || dailyGoal <= 0) {
    return null
  }
  return Math.min(100, Math.round((completedToday / dailyGoal) * 100))
}
