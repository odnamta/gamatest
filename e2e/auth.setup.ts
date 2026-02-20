import { test as setup, expect } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', 'admin@gis.cekatan.com')
  await page.fill('#password', 'password123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 })

  // Save signed-in state
  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})
