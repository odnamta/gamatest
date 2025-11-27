/**
 * Study Log Helper Functions
 * 
 * This module provides pure functions for study log operations
 * that can be tested with property-based testing.
 */

export interface StudyLogState {
  userId: string;
  studyDate: string; // YYYY-MM-DD format
  cardsReviewed: number;
}

export interface StudyLogRecord {
  user_id: string;
  study_date: string;
  cards_reviewed: number;
}

/**
 * Calculates the new study log state after a card rating.
 * This is a pure function that simulates the upsert logic.
 * 
 * @param existingLog - The existing study log for the date (null if none exists)
 * @param userId - The user's ID
 * @param studyDate - The study date in YYYY-MM-DD format
 * @returns The new study log state
 */
export function calculateStudyLogUpdate(
  existingLog: StudyLogRecord | null,
  userId: string,
  studyDate: string
): StudyLogState {
  if (existingLog) {
    // Increment existing record
    return {
      userId,
      studyDate,
      cardsReviewed: existingLog.cards_reviewed + 1,
    };
  }
  
  // Create new record with count of 1
  return {
    userId,
    studyDate,
    cardsReviewed: 1,
  };
}

/**
 * Simulates N card ratings on a given date and returns the final study log state.
 * This is useful for property testing to verify that after N ratings,
 * there is exactly one record with cards_reviewed = N.
 * 
 * @param userId - The user's ID
 * @param studyDate - The study date in YYYY-MM-DD format
 * @param numRatings - Number of card ratings to simulate
 * @returns The final study log state after all ratings
 */
export function simulateStudyLogAfterRatings(
  userId: string,
  studyDate: string,
  numRatings: number
): StudyLogState {
  let currentLog: StudyLogRecord | null = null;
  
  for (let i = 0; i < numRatings; i++) {
    const newState = calculateStudyLogUpdate(currentLog, userId, studyDate);
    currentLog = {
      user_id: newState.userId,
      study_date: newState.studyDate,
      cards_reviewed: newState.cardsReviewed,
    };
  }
  
  // If no ratings, return empty state
  if (numRatings === 0) {
    return {
      userId,
      studyDate,
      cardsReviewed: 0,
    };
  }
  
  return {
    userId,
    studyDate,
    cardsReviewed: currentLog!.cards_reviewed,
  };
}
