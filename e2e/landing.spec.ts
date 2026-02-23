import { test, expect } from '@playwright/test'

// Landing page is public — no auth needed
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders hero with title and CTAs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Cekatan', level: 1 })).toBeVisible()
    await expect(page.getByText('Assessment. Competency. Certification.')).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /learn more/i })).toBeVisible()
  })

  test('shows trusted-by section with organizations', async ({ page }) => {
    await expect(page.getByText('Trusted by')).toBeVisible()
    await expect(page.getByText('PT. Gama Intisamudera')).toBeVisible()
    await expect(page.getByText('PT. Gama Lintas Samudera')).toBeVisible()
  })

  test('displays all 4 feature cards', async ({ page }) => {
    await expect(page.getByText('Smart Study')).toBeVisible()
    await expect(page.getByText('Secure Assessment')).toBeVisible()
    await expect(page.getByText('Analytics')).toBeVisible()
    await expect(page.getByText('AI-Powered Content')).toBeVisible()
  })

  test('shows how-it-works steps', async ({ page }) => {
    await expect(page.getByText('How it works')).toBeVisible()
    await expect(page.getByText('Create Organization')).toBeVisible()
    await expect(page.getByText('Build Assessments')).toBeVisible()
    await expect(page.getByText('Measure & Improve')).toBeVisible()
  })

  test('CTA banner links to login', async ({ page }) => {
    await expect(page.getByText('Ready to assess your team?')).toBeVisible()
    const ctaLink = page.getByRole('link', { name: /get started free/i })
    await expect(ctaLink).toBeVisible()
    await expect(ctaLink).toHaveAttribute('href', '/login')
  })

  test('Get Started navigates to login', async ({ page }) => {
    await page.getByRole('link', { name: /get started/i }).first().click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('footer shows copyright and sign-in link', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer.getByText('Cekatan', { exact: true })).toBeVisible()
    await expect(footer.getByRole('link', { name: /sign in/i })).toBeVisible()
  })
})
