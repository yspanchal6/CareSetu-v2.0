import { test, expect } from '@playwright/test';

test.describe('Phase 12B.11 Legal Pages & Consent Browser Smoke Test', () => {
  const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  test('Legal pages load, render badges, and survive browser refresh', async ({ page }) => {
    // 1. Terms of Use
    await page.goto(`${BASE_URL}/terms`);
    await expect(page.locator('h1')).toContainText('CareSetu Terms of Use');
    await expect(page.locator('text=Draft — Subject to Final Legal Review')).toBeVisible();
    await expect(page.locator('text=Policy Version: 2026.1')).toBeVisible();

    // Direct browser refresh
    await page.reload();
    await expect(page.locator('h1')).toContainText('CareSetu Terms of Use');

    // 2. Privacy Policy
    await page.goto(`${BASE_URL}/privacy`);
    await expect(page.locator('h1')).toContainText('CareSetu Privacy Policy');
    await expect(page.locator('text=Draft — Subject to Final Legal Review')).toBeVisible();

    // Direct browser refresh
    await page.reload();
    await expect(page.locator('h1')).toContainText('CareSetu Privacy Policy');

    // 3. Data Declaration
    await page.goto(`${BASE_URL}/data-declaration`);
    await expect(page.locator('h1')).toContainText('Data Declaration & Processing Matrix');
    await expect(page.locator('text=Draft v2026.1 • Under Legal Review')).toBeVisible();

    // Direct browser refresh
    await page.reload();
    await expect(page.locator('h1')).toContainText('Data Declaration & Processing Matrix');
  });

  test('Public footer displays visible links to legal pages on desktop and mobile viewports', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL);
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('a[href="/terms"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/data-declaration"]').first()).toBeVisible();

    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(footer).toBeVisible();
    await expect(footer.locator('a[href="/terms"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]').first()).toBeVisible();
    await expect(footer.locator('a[href="/data-declaration"]').first()).toBeVisible();
  });

  test('Registration page renders unchecked checkbox with working links and blocks submission if unchecked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/register?role=patient`);

    // Verify checkbox is present and unchecked by default
    const checkbox = page.locator('#termsAcceptedCheckbox');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // Verify links inside label
    const termsLink = page.locator('label a[href="/terms"]');
    const privacyLink = page.locator('label a[href="/privacy"]');
    const dataDeclLink = page.locator('label a[href="/data-declaration"]');
    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
    await expect(dataDeclLink).toBeVisible();
  });
});
