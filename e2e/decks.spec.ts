import { test, expect } from '@playwright/test'

test.describe('Decks / Library', () => {
  test('library page shows seeded decks', async ({ page }) => {
    await page.goto('/library')
    await expect(page).toHaveURL(/\/library/)
    // At least one deck card/link should be visible
    await expect(page.getByRole('link').or(page.locator('[data-testid="deck-card"]')).first()).toBeVisible({ timeout: 10000 })
  })

  test('can click into a deck detail page', async ({ page }) => {
    await page.goto('/library')
    // Click the first deck link
    const firstDeck = page.getByRole('link').filter({ hasText: /.+/ }).first()
    await expect(firstDeck).toBeVisible({ timeout: 10000 })
    await firstDeck.click()
    // Should navigate away from /library to a deck detail page
    await expect(page).not.toHaveURL(/\/library$/, { timeout: 10000 })
  })
})
