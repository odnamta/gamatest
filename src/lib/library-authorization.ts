import type { DeckTemplate, UserDeck } from '@/types/database'

/**
 * Checks if a deck template is visible to a user.
 * A deck is visible if:
 * - visibility = 'public', OR
 * - author_id = userId (user is the author)
 * 
 * Requirements: 1.1, 2.3
 */
export function isDeckVisibleToUser(
  deck: Pick<DeckTemplate, 'visibility' | 'author_id'>,
  userId: string | null
): boolean {
  if (!userId) return deck.visibility === 'public'
  return deck.visibility === 'public' || deck.author_id === userId
}

/**
 * Filters deck templates to only those visible to the user.
 * 
 * Requirements: 1.1
 */
export function filterVisibleDecks<T extends Pick<DeckTemplate, 'visibility' | 'author_id'>>(
  decks: T[],
  userId: string | null
): T[] {
  return decks.filter(deck => isDeckVisibleToUser(deck, userId))
}

/**
 * Checks if a user is subscribed to a deck template.
 * A user is subscribed if there exists a user_decks record with:
 * - user_id = userId
 * - deck_template_id = deckId
 * - is_active = true
 * 
 * Requirements: 1.4, 2.1
 */
export function isUserSubscribed(
  userDecks: Pick<UserDeck, 'user_id' | 'deck_template_id' | 'is_active'>[],
  userId: string,
  deckId: string
): boolean {
  return userDecks.some(
    ud => ud.user_id === userId && ud.deck_template_id === deckId && ud.is_active === true
  )
}

/**
 * Validates that a user can subscribe to a deck.
 * Returns true if the deck is visible to the user.
 * 
 * Requirements: 2.3
 */
export function canUserSubscribe(
  deck: Pick<DeckTemplate, 'visibility' | 'author_id'>,
  userId: string
): { allowed: boolean; reason: 'allowed' | 'not_visible' | 'no_user' } {
  if (!userId) {
    return { allowed: false, reason: 'no_user' }
  }
  if (!isDeckVisibleToUser(deck, userId)) {
    return { allowed: false, reason: 'not_visible' }
  }
  return { allowed: true, reason: 'allowed' }
}

/**
 * Simulates subscription action on user_decks array.
 * Creates new record or reactivates existing one.
 * 
 * Requirements: 2.1, 2.2
 */
export function applySubscription(
  userDecks: UserDeck[],
  userId: string,
  deckTemplateId: string
): UserDeck[] {
  const existingIndex = userDecks.findIndex(
    ud => ud.user_id === userId && ud.deck_template_id === deckTemplateId
  )

  if (existingIndex >= 0) {
    // Reactivate existing subscription
    return userDecks.map((ud, i) =>
      i === existingIndex ? { ...ud, is_active: true } : ud
    )
  }

  // Create new subscription
  const newSubscription: UserDeck = {
    id: `new-${Date.now()}`,
    user_id: userId,
    deck_template_id: deckTemplateId,
    is_active: true,
    created_at: new Date().toISOString(),
  }

  return [...userDecks, newSubscription]
}

/**
 * Simulates unsubscription action on user_decks array.
 * Sets is_active = false (soft delete).
 * 
 * Requirements: 4.1
 */
export function applyUnsubscription(
  userDecks: UserDeck[],
  userId: string,
  deckTemplateId: string
): UserDeck[] {
  return userDecks.map(ud =>
    ud.user_id === userId && ud.deck_template_id === deckTemplateId
      ? { ...ud, is_active: false }
      : ud
  )
}

/**
 * Filters user_decks to only active subscriptions for a user.
 * 
 * Requirements: 3.1
 */
export function getActiveSubscriptions(
  userDecks: UserDeck[],
  userId: string
): UserDeck[] {
  return userDecks.filter(ud => ud.user_id === userId && ud.is_active === true)
}

/**
 * Calculates due count for a deck based on progress records.
 * Due cards have next_review <= now.
 * 
 * Requirements: 3.3
 */
export function calculateDueCount(
  progressRecords: { card_template_id: string; next_review: string; deck_template_id: string }[],
  deckTemplateId: string,
  now: Date = new Date()
): number {
  const nowStr = now.toISOString()
  return progressRecords.filter(
    p => p.deck_template_id === deckTemplateId && p.next_review <= nowStr
  ).length
}
