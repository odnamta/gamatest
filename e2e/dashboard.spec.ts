import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('dashboard loads successfully', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    // Page should have content (not a blank page or error)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('navigation elements are visible', async ({ page }) => {
    await page.goto('/dashboard')
    // Logout button or link should exist
    await expect(page.getByRole('button', { name: /logout|sign out/i }).or(
      page.getByRole('link', { name: /logout|sign out/i })
    )).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to /library', async ({ page }) => {
    await page.goto('/dashboard')
    // Find and click a link to library
    await page.getByRole('link', { name: /library/i }).click()
    await expect(page).toHaveURL(/\/library/)
  })
})
