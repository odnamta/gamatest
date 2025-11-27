import type { SessionState } from '@/types/session'

/**
 * Initial session state with zero counts.
 */
export const initialSessionState: SessionState = {
  cardsReviewed: 0,
  ratings: {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  },
}

/**
 * Updates session state after a card rating.
 * Pure function for testability.
 * Requirements: 3.1, 3.2
 * 
 * @param state - Current session state
 * @param rating - Rating given (1=again, 2=hard, 3=good, 4=easy)
 * @returns Updated session state
 */
export function updateSessionState(
  state: SessionState,
  rating: 1 | 2 | 3 | 4
): SessionState {
  const ratingKey = rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy'
  
  return {
    cardsReviewed: state.cardsReviewed + 1,
    ratings: {
      ...state.ratings,
      [ratingKey]: state.ratings[ratingKey] + 1,
    },
  }
}

/**
 * Applies a sequence of ratings to an initial session state.
 * Useful for testing and simulation.
 * 
 * @param ratings - Array of ratings to apply
 * @returns Final session state after all ratings
 */
export function applyRatings(ratings: Array<1 | 2 | 3 | 4>): SessionState {
  return ratings.reduce(
    (state, rating) => updateSessionState(state, rating),
    initialSessionState
  )
}
