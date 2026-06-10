import { test, expect } from '@playwright/test';

// Basic e2e smoke test (KAN-33): confirms the app boots, the landing page
// renders, and client-side routing to /login works. No backend required.
test.describe('smoke', () => {
  test('landing page loads and shows the brand', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/TheThinker/);
    await expect(page.getByText('TheThinker').first()).toBeVisible();
  });

  test('can navigate to the login page', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/login$/);
    // The login screen should render an email field for sign-in.
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
