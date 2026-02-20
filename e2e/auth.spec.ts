import { test, expect } from '@playwright/test'

// These tests run WITHOUT stored auth (unauthenticated)
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication', () => {
  test('redirects to /login when accessing /dashboard unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'wrong@example.com')
    await page.fill('#password', 'wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Error message should appear
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 })
  })

  test('valid credentials redirect to /dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', 'admin@gis.cekatan.com')
    await page.fill('#password', 'password123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })
  })
})
