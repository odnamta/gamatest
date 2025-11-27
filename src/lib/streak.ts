/**
 * Streak Calculator Implementation
 * 
 * This module implements streak calculation logic for tracking consecutive
 * study days in the gamification system.
 */

import { differenceInCalendarDays, startOfDay } from 'date-fns';

export interface StreakInput {
  lastStudyDate: Date | null;
  currentStreak: number;
  todayDate: Date;
}

export interface StreakOutput {
  newStreak: number;
  lastStudyDate: Date;
  isNewDay: boolean;
}

/**
 * Calculates the updated streak based on the last study date and today's date.
 * 
 * Rules:
 * - Same day study: streak remains unchanged
 * - Consecutive day study (yesterday + 1): streak increments by 1
 * - Gap day study (more than 1 day): streak resets to 1
 * - First study ever (null lastStudyDate): streak starts at 1
 * 
 * @param input - The current streak state and today's date
 * @returns The updated streak state
 */
export function calculateStreak(input: StreakInput): StreakOutput {
  const { lastStudyDate, currentStreak, todayDate } = input;
  
  // Normalize dates to start of day for accurate comparison
  const today = startOfDay(todayDate);
  
  // First study ever - start streak at 1
  if (lastStudyDate === null) {
    return {
      newStreak: 1,
      lastStudyDate: today,
      isNewDay: true,
    };
  }
  
  const lastStudy = startOfDay(lastStudyDate);
  const daysDifference = differenceInCalendarDays(today, lastStudy);
  
  // Same day study - no change to streak
  if (daysDifference === 0) {
    return {
      newStreak: currentStreak,
      lastStudyDate: lastStudy,
      isNewDay: false,
    };
  }
  
  // Consecutive day study - increment streak
  if (daysDifference === 1) {
    return {
      newStreak: currentStreak + 1,
      lastStudyDate: today,
      isNewDay: true,
    };
  }
  
  // Gap day study (more than 1 day) - reset streak to 1
  return {
    newStreak: 1,
    lastStudyDate: today,
    isNewDay: true,
  };
}

/**
 * Updates the longest streak if the current streak exceeds it.
 * 
 * @param currentStreak - The current streak value
 * @param longestStreak - The longest streak recorded
 * @returns The updated longest streak value
 */
export function updateLongestStreak(currentStreak: number, longestStreak: number): number {
  return Math.max(currentStreak, longestStreak);
}

/**
 * Increments the total reviews count by 1.
 * 
 * @param totalReviews - The current total reviews count
 * @returns The incremented total reviews count
 */
export function incrementTotalReviews(totalReviews: number): number {
  return totalReviews + 1;
}
