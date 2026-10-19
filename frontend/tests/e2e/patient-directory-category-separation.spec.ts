import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('CareSetu Phase 12B.38 — Patient Directory Category Separation & Restrictions', () => {
  test('Verify Category Separation between Physical Hospitals and Government PM-JAY Stats', async ({ page }) => {
    // Step 1: Sign in as Patient
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'test.patient@caresetu.local');
    await page.fill('input[type="password"]', 'Test@12345');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/patient\/dashboard/);

    // Step 2: Navigate to Patient Hospitals Discovery
    await page.goto(`${BASE_URL}/patient/hospitals`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify 4 category tabs exist
    const hospitalsTab = page.locator('button:has-text("Hospitals (Physical Facilities)")');
    const statsTab = page.locator('button:has-text("Government Health Stats (AB PM-JAY)")');
    const clinicsTab = page.locator('button:has-text("Clinics")');
    const doctorsTab = page.locator('button:has-text("Doctors")');

    await expect(hospitalsTab).toBeVisible();
    await expect(statsTab).toBeVisible();
    await expect(clinicsTab).toBeVisible();
    await expect(doctorsTab).toBeVisible();

    // Step 3: In Hospitals Tab, verify physical facilities exist and PM_JAY is excluded
    await hospitalsTab.click();
    await page.waitForTimeout(1500);

    const hospitalsText = await page.innerText('body');
    // CareSetu Test Hospital [DEMO] and District Civil Hospital Nashik must be present
    expect(hospitalsText).toContain('CareSetu Test Hospital [DEMO]');
    expect(hospitalsText).toContain('District Civil Hospital');
    // Must NOT contain AB PM-JAY Admissions Data
    expect(hospitalsText).not.toContain('AB PM-JAY Admissions Data');

    // Step 4: Switch to Government Health Stats Tab
    await statsTab.click();
    await page.waitForTimeout(1500);

    const statsText = await page.innerText('body');
    // Must contain AB PM-JAY state records
    expect(statsText).toContain('AB PM-JAY Admissions Data');
    // Must NOT contain physical CareSetu hospital
    expect(statsText).not.toContain('CareSetu Test Hospital [DEMO]');

    // Step 5: Test Map View in Statistics tab (Map markers disabled message)
    const mapToggleBtn = page.locator('button:has-text("Show Map Markers")');
    if (await mapToggleBtn.isVisible()) {
      await mapToggleBtn.click();
      await page.waitForTimeout(1000);
      const postMapText = await page.innerText('body');
      expect(postMapText).toContain('Map markers are disabled for Government Health Statistics');
    }

    // Step 6: Test Detail View & Emergency Dispatch Restrictions
    // Switch back to Hospitals tab
    await hospitalsTab.click();
    await page.waitForTimeout(1000);

    // CareSetu Registered Hospital should have 'CareSetu Registered' badge
    expect(await page.innerText('body')).toContain('CareSetu Registered');

    // View Details on a District Hospital
    const searchInput = page.locator('input').first();
    await searchInput.fill('Nashik');
    await page.waitForTimeout(1000);

    const detailLink = page.getByRole('link', { name: /View Directory Record/i }).first();
    await Promise.all([
      page.waitForURL(/\/patient\/hospitals\/[a-zA-Z0-9-]+/),
      detailLink.click(),
    ]);
    await page.waitForSelector('text=Location Details');

    const detailPageText = await page.innerText('body');
    // Must have Government Open Data badge and bed count
    expect(detailPageText).toContain('Government Open Data');
    expect(detailPageText).toContain('VERIFIED BED COUNT');
    expect(detailPageText).toContain('650 Beds');
    // Must NOT have 'Request Emergency Case' button (Emergency dispatch is restricted to CareSetu network)
    const emergencyBtn = page.locator('button:has-text("Request Emergency Case")');
    expect(await emergencyBtn.isVisible()).toBe(false);

    // Step 7: View Details on Registered Hospital
    await page.goto(`${BASE_URL}/patient/hospitals`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.locator('input').first().fill('CareSetu Test Hospital');
    await page.waitForTimeout(1000);

    const regDetailLink = page.getByRole('link', { name: /View Directory Record/i }).first();
    await Promise.all([
      page.waitForURL(/\/patient\/hospitals\/[a-zA-Z0-9-]+/),
      regDetailLink.click(),
    ]);
    await page.waitForSelector('text=Location Details');

    // Registered Hospital MUST have 'Request Emergency Case' button
    const regEmergencyBtn = page.locator('button:has-text("Request Emergency Case")');
    expect(await regEmergencyBtn.isVisible()).toBe(true);

    console.log('[PASS] CareSetu Phase 12B.38 — Category Separation & Emergency Safety verified.');
  });
});
