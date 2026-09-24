import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface StepResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  durationMs: number;
  details?: string;
}

const E2E_PATIENT_EMAIL = process.env.E2E_PATIENT_EMAIL || 'test.patient@caresetu.local';
const E2E_PATIENT_PASSWORD = process.env.E2E_PATIENT_PASSWORD || 'Test@12345';
const E2E_HOSPITAL_EMAIL = process.env.E2E_HOSPITAL_EMAIL || 'test.hospital@caresetu.local';
const E2E_HOSPITAL_PASSWORD = process.env.E2E_HOSPITAL_PASSWORD || 'Test@12345';
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('CareSetu E2E Critical Demo Suite', () => {
  test('CareSetu Critical Demo — Patient SOS → Hospital Acceptance → HealthPack', async ({ browser }) => {
    test.setTimeout(120000);

    const startTime = Date.now();
    const reportsDir = path.resolve(process.cwd(), '../reports');
    const screenshotsDir = path.resolve(reportsDir, 'screenshots');

    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    const stepResults: StepResult[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const http4xx: string[] = [];
    const http5xx: string[] = [];
    const screenshots: string[] = [];

    let capturedCaseId = '';
    let overallStatus: 'PASS' | 'FAIL' = 'FAIL';

    async function runStep(name: string, stepFn: () => Promise<void>) {
      const stepStart = Date.now();
      try {
        await stepFn();
        const durationMs = Date.now() - stepStart;
        stepResults.push({ name, status: 'PASS', durationMs });
        console.log(`[PASS] ${name} (${durationMs}ms)`);
      } catch (err: any) {
        const durationMs = Date.now() - stepStart;
        stepResults.push({ name, status: 'FAIL', durationMs, details: err.message });
        console.error(`[FAIL] ${name} (${durationMs}ms): ${err.message}`);
        throw err;
      }
    }

    try {
      // =========================================================================
      // STEP 1 — PATIENT LOGIN
      // =========================================================================
      const patientContext = await browser.newContext({
        geolocation: { latitude: 22.5360, longitude: 72.8950 },
        permissions: ['geolocation'],
      });
      const patientPage = await patientContext.newPage();

      patientPage.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[Patient] ${msg.text()}`);
      });
      patientPage.on('pageerror', (err) => pageErrors.push(`[Patient] ${err.message}`));
      patientPage.on('response', (res) => {
        if (res.status() >= 400 && res.status() < 500) http4xx.push(`[Patient] ${res.status()} ${res.url()}`);
        if (res.status() >= 500) http5xx.push(`[Patient] ${res.status()} ${res.url()}`);
      });

      await runStep('Patient Login', async () => {
        await patientPage.goto(`${BASE_URL}/login`);
        await patientPage.waitForLoadState('networkidle');

        await patientPage.fill('input[type="email"]', E2E_PATIENT_EMAIL);
        await patientPage.fill('input[type="password"]', E2E_PATIENT_PASSWORD);
        await patientPage.click('button[type="submit"]');

        await patientPage.waitForURL(/\/patient\/dashboard/, { timeout: 15000 });
        await expect(patientPage.locator('h2')).toContainText(/Good morning|Test|CareSetu/i);

        const screenshotPath = path.join(screenshotsDir, '01-patient-login.png');
        await patientPage.screenshot({ path: screenshotPath });
        screenshots.push('screenshots/01-patient-login.png');
      });

      // =========================================================================
      // STEP 2 — EMERGENCY SOS TRIGGER
      // =========================================================================
      await runStep('Emergency SOS Trigger', async () => {
        await patientPage.goto(`${BASE_URL}/patient/emergency`);
        await patientPage.waitForLoadState('networkidle');

        const sosButton = patientPage.locator('button[aria-label="Tap to send emergency SOS"], button:has-text("SOS")').first();
        await expect(sosButton).toBeVisible();

        const [response] = await Promise.all([
          patientPage.waitForResponse((res) => res.url().includes('/api/emergency/sos') && res.status() === 201),
          sosButton.click(),
        ]);

        expect(response.status()).toBe(201);

        const screenshotPath = path.join(screenshotsDir, '02-sos-triggered.png');
        await patientPage.screenshot({ path: screenshotPath });
        screenshots.push('screenshots/02-sos-triggered.png');
      });

      // =========================================================================
      // STEP 3 — VERIFY CASE CREATION & CAPTURE CASE ID
      // =========================================================================
      await runStep('Case Creation & ID Capture', async () => {
        await patientPage.waitForSelector('text=Emergency case created', { timeout: 15000 });

        const caseIdElement = patientPage.locator('.font-mono.text-lg, p:has-text("EMG-"), .font-mono').first();
        capturedCaseId = (await caseIdElement.innerText()).trim();

        console.log(`[Dynamic Case ID Captured]: ${capturedCaseId}`);
        expect(capturedCaseId).toBeTruthy();
        expect(capturedCaseId.length).toBeGreaterThan(3);

        const screenshotPath = path.join(screenshotsDir, '03-case-created.png');
        await patientPage.screenshot({ path: screenshotPath });
        screenshots.push('screenshots/03-case-created.png');
      });

      // =========================================================================
      // STEP 4 — HOSPITAL LOGIN (SECOND BROWSER CONTEXT)
      // =========================================================================
      const hospitalContext = await browser.newContext();
      const hospitalPage = await hospitalContext.newPage();

      hospitalPage.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[Hospital] ${msg.text()}`);
      });
      hospitalPage.on('pageerror', (err) => pageErrors.push(`[Hospital] ${err.message}`));
      hospitalPage.on('response', (res) => {
        if (res.status() >= 400 && res.status() < 500) http4xx.push(`[Hospital] ${res.status()} ${res.url()}`);
        if (res.status() >= 500) http5xx.push(`[Hospital] ${res.status()} ${res.url()}`);
      });

      await runStep('Hospital Login (Second Browser Context)', async () => {
        await hospitalPage.goto(`${BASE_URL}/login`);
        await hospitalPage.waitForLoadState('networkidle');

        await hospitalPage.fill('input[type="email"]', E2E_HOSPITAL_EMAIL);
        await hospitalPage.fill('input[type="password"]', E2E_HOSPITAL_PASSWORD);
        await hospitalPage.click('button[type="submit"]');

        await hospitalPage.waitForURL(/\/hospital\/dashboard/, { timeout: 15000 });
      });

      // =========================================================================
      // STEP 5 — LOCATE SAME CASE IN HOSPITAL PORTAL
      // =========================================================================
      await runStep('Locate Same Case ID in Hospital Portal', async () => {
        await hospitalPage.goto(`${BASE_URL}/hospital/emergencies`);
        await hospitalPage.waitForLoadState('networkidle');

        const caseInList = hospitalPage.locator(`text=${capturedCaseId}`).first();
        await expect(caseInList).toBeVisible({ timeout: 15000 });

        const screenshotPath = path.join(screenshotsDir, '04-hospital-case-found.png');
        await hospitalPage.screenshot({ path: screenshotPath });
        screenshots.push('screenshots/04-hospital-case-found.png');
      });

      // =========================================================================
      // STEP 6 — ACCEPT CASE
      // =========================================================================
      await runStep('Hospital Case Acceptance', async () => {
        const socketPopupAccept = hospitalPage.locator('button:has-text("Accept Case")').first();

        if (await socketPopupAccept.isVisible({ timeout: 2000 })) {
          const [acceptRes] = await Promise.all([
            hospitalPage.waitForResponse((res) => res.url().includes('/accept') && res.status() === 200),
            socketPopupAccept.click(),
          ]);
          expect(acceptRes.status()).toBe(200);
        } else {
          // Open detail view for the case
          await hospitalPage.click(`text=${capturedCaseId}`);
          await hospitalPage.waitForURL(new RegExp(`/hospital/emergencies/${capturedCaseId}`), { timeout: 10000 });

          // Click Accept Case button on detail view
          await hospitalPage.click('button:has-text("Accept Case")');

          // Click Confirm and assign doctor in confirmation modal
          const confirmBtn = hospitalPage.locator('button:has-text("Confirm and assign doctor")').first();
          await expect(confirmBtn).toBeVisible({ timeout: 5000 });

          const [acceptRes] = await Promise.all([
            hospitalPage.waitForResponse((res) => res.url().includes('/accept') && res.status() === 200),
            confirmBtn.click(),
          ]);
          expect(acceptRes.status()).toBe(200);
        }

        // Navigate / wait for redirect to Active Cases page
        await hospitalPage.goto(`${BASE_URL}/hospital/emergencies/active`);
        await hospitalPage.waitForLoadState('networkidle');

        const activeCard = hospitalPage.locator(`text=${capturedCaseId}`).first();
        await expect(activeCard).toBeVisible({ timeout: 15000 });

        const screenshotPath = path.join(screenshotsDir, '05-case-accepted.png');
        await hospitalPage.screenshot({ path: screenshotPath });
        screenshots.push('screenshots/05-case-accepted.png');
      });

      // =========================================================================
      // STEP 7 — HEALTH PACK ACCESS
      // =========================================================================
      await runStep('Health Pack Access', async () => {
        const viewHealthPackBtn = hospitalPage.locator('button:has-text("View Health Pack")').first();
        await expect(viewHealthPackBtn).toBeVisible({ timeout: 10000 });

        await viewHealthPackBtn.click();
        await hospitalPage.waitForSelector('text=Secure Patient Health Pack', { timeout: 15000 });

        const screenshotPath = path.join(screenshotsDir, '06-healthpack-opened.png');
        await hospitalPage.screenshot({ path: screenshotPath });
        screenshots.push('screenshots/06-healthpack-opened.png');
      });

      // =========================================================================
      // STEP 8, 9 & 10 — HEALTH DATA, PATIENT NAME & CONSENT VALIDATION
      // =========================================================================
      await runStep('Health Data & Patient Name Validation', async () => {
        // Wait for decrypted content to load inside the Health Pack Modal
        await hospitalPage.waitForSelector('text=Patient Profile', { timeout: 15000 });

        const modalContainer = hospitalPage.locator('.max-w-2xl.w-full').last();
        const modalText = await modalContainer.innerText();

        console.log('[HealthPack Decrypted Content Extracted]:\n', modalText);

        // Validation 1: Blood Group must not be NOT_PROVIDED
        expect(modalText).not.toContain('NOT_PROVIDED');
        expect(modalText).toMatch(/O\+|A\+|B\+|AB\+/);

        // Validation 2: Patient Name must not be Emergency Patient
        expect(modalText).not.toContain('Emergency Patient');
        expect(modalText).toMatch(/CareSetu Test Patient|Test Patient/i);

        // Validation 3: Medical Conditions & Allergies present
        expect(modalText).toMatch(/Penicillin|Peanuts|Hypertension|Asthma|None reported/i);

        // Validation 4: Consent Active badge visible
        expect(modalText).toContain('Consent Active');

        const screenshotPath = path.join(screenshotsDir, '07-healthpack-validated.png');
        await hospitalPage.screenshot({ path: screenshotPath });
        screenshots.push('screenshots/07-healthpack-validated.png');
      });

      overallStatus = 'PASS';
      await patientContext.close();
      await hospitalContext.close();
    } catch (err: any) {
      console.error('[E2E Test Execution Error]', err);
    } finally {
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();
      const startedAt = new Date(startTime).toISOString();

      const filteredConsoleErrors = consoleErrors.filter((e) => !e.includes('Download the React DevTools') && !e.includes('favicon'));
      const criticalErrors = stepResults.filter((s) => s.status === 'FAIL').map((s) => `${s.name}: ${s.details}`);

      // =========================================================================
      // JSON REPORT GENERATION
      // =========================================================================
      const jsonReport = {
        project: 'CareSetu',
        scenario: 'Critical Demo — Patient SOS → Hospital Acceptance → HealthPack',
        startedAt,
        finishedAt,
        durationMs,
        browser: 'chromium',
        overallStatus,
        caseId: capturedCaseId,
        environment: {
          frontendUrl: BASE_URL,
          backendUrl: 'http://localhost:3000',
        },
        steps: stepResults,
        consoleErrors: filteredConsoleErrors,
        pageErrors,
        http4xx,
        http5xx,
        criticalErrors,
        artifacts: {
          screenshots,
          trace: 'reports/html-report',
        },
      };

      const jsonReportPath = path.join(reportsDir, 'careSetu-critical-demo-report.json');
      fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));

      // =========================================================================
      // HTML REPORT GENERATION
      // =========================================================================
      const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CareSetu Critical Demo — E2E Execution Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .container { max-width: 1000px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #1e293b; margin: 0; }
    .badge { font-size: 14px; font-weight: 700; padding: 6px 16px; border-radius: 9999px; text-transform: uppercase; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .card { background: #f1f5f9; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .card-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .card-value { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { background: #f8fafc; color: #475569; font-weight: 700; }
    .status-pass { color: #166534; font-weight: 700; }
    .status-fail { color: #991b1b; font-weight: 700; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-top: 16px; }
    .gallery img { width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .section-title { font-size: 18px; font-weight: 700; color: #1e293b; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title">CareSetu — Critical Demo E2E Report</h1>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Patient SOS → Hospital Acceptance → Real HealthPack Verification</p>
      </div>
      <span class="badge ${overallStatus === 'PASS' ? 'badge-pass' : 'badge-fail'}">${overallStatus}</span>
    </div>

    <div class="grid">
      <div class="card"><div class="card-label">Case ID Captured</div><div class="card-value">${capturedCaseId || 'N/A'}</div></div>
      <div class="card"><div class="card-label">Total Duration</div><div class="card-value">${(durationMs / 1000).toFixed(2)}s</div></div>
      <div class="card"><div class="card-label">Execution Environment</div><div class="card-value">Frontend: ${BASE_URL} | Backend: http://localhost:3000</div></div>
      <div class="card"><div class="card-label">Browser & Engine</div><div class="card-value">Chromium Headless</div></div>
    </div>

    <h2 class="section-title">Step Execution Results</h2>
    <table>
      <thead>
        <tr>
          <th>Step Name</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${stepResults
          .map(
            (s) => `
          <tr>
            <td style="font-weight: 600;">${s.name}</td>
            <td class="${s.status === 'PASS' ? 'status-pass' : 'status-fail'}">${s.status}</td>
            <td>${s.durationMs}ms</td>
            <td>${s.details || '—'}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h2 class="section-title">Evidence Screenshots</h2>
    <div class="gallery">
      ${screenshots
        .map(
          (s) => `
        <div>
          <img src="${s}" alt="Screenshot" />
          <p style="font-size: 11px; text-align: center; color: #64748b; margin-top: 4px;">${path.basename(s)}</p>
        </div>`
        )
        .join('')}
    </div>
  </div>
</body>
</html>
      `;

      const htmlReportPath = path.join(reportsDir, 'careSetu-critical-demo-report.html');
      fs.writeFileSync(htmlReportPath, htmlReport);

      console.log(`\n==================================================`);
      console.log(`CARESETU E2E TEST EXECUTION COMPLETED: ${overallStatus}`);
      console.log(`JSON Report: ${jsonReportPath}`);
      console.log(`HTML Report: ${htmlReportPath}`);
      console.log(`==================================================\n`);

      if (overallStatus !== 'PASS') {
        throw new Error(`E2E Test Failed: ${criticalErrors.join('; ')}`);
      }
    }
  });
});
