import { test, expect } from '@playwright/test'

// These tests run WITHOUT stored auth (unauthenticated)
test.use({ storageState: { cookies: [], origins: [] } })

const protectedRoutes = [
  '/dashboard',
  '/library',
  '/study',
  '/stats',
  '/profile',
  '/admin',
  '/skills',
  '/assessments',
]

for (const route of protectedRoutes) {
  test(`${route} redirects to /login when unauthenticated`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
}
