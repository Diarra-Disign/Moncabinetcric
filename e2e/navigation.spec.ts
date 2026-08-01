import { test, expect } from '@playwright/test'

test.describe('Navigation & Locale Switcher E2E', () => {
  test('should load French dashboard and verify key UI elements', async ({ page }) => {
    await page.goto('http://localhost:3000/fr/dashboard')
    await expect(page).toHaveTitle(/moncabinetcric/)
    await expect(page.getByText('moncabinetcric')).toBeVisible()
  })

  test('should load English dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/en/dashboard')
    await expect(page).toHaveTitle(/moncabinetcric/)
  })

  test('should navigate to matters page', async ({ page }) => {
    await page.goto('http://localhost:3000/fr/matters')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
