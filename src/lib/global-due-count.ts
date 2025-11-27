/**
 * Global Due Count Computation
 * Pure function for calculating total due cards across all decks.
 * Requirements: 1.2
 * 
 * Feature: v3-ux-overhaul
 */

/**
 * Computes the count of due cards from a list of cards.
 * A card is due if its next_review timestamp is less than or equal to now.
 * 
 * @param cards - Array of cards with next_review timestamps
 * @param now - Current timestamp in ISO format
 * @returns Number of due cards
 */
export function computeGlobalDueCount(
  cards: { next_review: string }[],
  now: string
): number {
  const nowDate = new Date(now)
  
  return cards.filter(card => {
    const nextReview = new Date(card.next_review)
    return nextReview <= nowDate
  }).length
}
