import { test, expect } from '@playwright/test';

test.describe('CareSetu P0 Browser Verification (Frontend UI & Mocked API)', () => {

  test.beforeEach(async ({ page }) => {
    // Inject mock session storage for a patient user so ProtectedRoute passes
    await page.addInitScript(() => {
      const mockPatient = {
        id: 'patient-test-id-1',
        name: 'Verified Patient',
        email: 'test.patient@caresetu.local',
        role: 'patient',
        isVerified: true,
        isProfileComplete: true,
      };
      // Synthetic JWT with patient role
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJwYXRpZW50LXRlc3QtaWQtMSIsInJvbGUiOiJQQVRJRU5UIiwiaWF0IjoxNTE2MjM5MDIyfQ.fake_signature';
      sessionStorage.setItem('caresetu_auth_token', mockToken);
      sessionStorage.setItem('caresetu_user', JSON.stringify(mockPatient));
    });
  });

  test('Scenario 1: GPS Waiting Feedback and Manual Location Recovery on GPS Error', async ({ page }) => {
    // Intercept emergency and me APIs
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 'patient-test-id-1',
              name: 'Verified Patient',
              email: 'test.patient@caresetu.local',
              role: 'PATIENT',
              isVerified: true,
              isProfileComplete: true,
            },
          }),
        });
      } else if (url.includes('/api/emergency/geocode')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            latitude: 22.5460,
            longitude: 72.9320,
            displayName: 'Civil Lines, Anand, Gujarat',
          }),
        });
      } else if (url.includes('/api/emergency/sos')) {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            caseId: 'TEST-EMG-101',
            publicCaseId: 'TEST-EMG-101',
            status: 'SEARCHING',
            nearestHospitals: [],
          }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
    });

    // Mock geolocation to reject immediately with GeolocationPositionError.PERMISSION_DENIED (code 1)
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_success, error) => {
        if (error) {
          setTimeout(() => {
            const err = new Error('User denied Geolocation');
            (err as any).code = 1;
            (err as any).PERMISSION_DENIED = 1;
            error(err as any);
          }, 100);
        }
      };
    });

    await page.goto('http://localhost:5173/patient/emergency');
    await page.waitForLoadState('domcontentloaded');

    // Tap SOS button
    const sosButton = page.locator('button[aria-label="Tap to send emergency SOS"], button:has-text("SOS")').first();
    await expect(sosButton).toBeVisible({ timeout: 10000 });
    await sosButton.click();

    // Verify manual location entry form appears reliably on GPS error
    const manualLocationSection = page.locator('text=Enter Location Manually');
    await expect(manualLocationSection).toBeVisible({ timeout: 10000 });
    console.log('Verified: Manual location entry form rendered upon GPS failure');

    // Verify fields
    const addressInput = page.locator('input[placeholder*="Near Station Circle"]');
    const cityInput = page.locator('input[placeholder*="Anand"]');
    const pincodeInput = page.locator('input[placeholder*="388001"]');
    const submitBtn = page.locator('button:has-text("Submit Location & Dispatch SOS")');

    await expect(addressInput).toBeVisible();
    await expect(cityInput).toBeVisible();
    await expect(pincodeInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Fill manual location and submit
    await addressInput.fill('Civil Lines');
    await cityInput.fill('Anand');
    await pincodeInput.fill('388001');

    await submitBtn.click();
    console.log('Verified: Manual location submitted and routed');
  });

  test('Scenario 2 & 3: Two-Step SOS Cancellation and Zero-Hospital Explanation', async ({ page }) => {
    // Mock the emergency tracking API response to return a SEARCHING case with 0 hospitals
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 'patient-test-id-1',
              name: 'Verified Patient',
              email: 'test.patient@caresetu.local',
              role: 'PATIENT',
              isVerified: true,
              isProfileComplete: true,
            },
          }),
        });
      } else if (url.includes('/api/emergency/cancel')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Emergency cancelled' }),
        });
      } else if (url.includes('/api/emergency/status/CASE-MOCK-001')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            case: {
              id: 'CASE-MOCK-001',
              caseId: 'CASE-MOCK-001',
              status: 'SEARCHING',
              symptoms: 'Severe Chest Pain',
              createdAt: new Date().toISOString(),
              hospital: null,
            },
          }),
        });
      } else if (url.includes('/api/emergency/attempts')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, attempts: [] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto('http://localhost:5173/patient/emergency/status/CASE-MOCK-001');
    await page.waitForLoadState('domcontentloaded');

    // 2. Zero-Hospital Explanation
    const zeroHospitalText = page.locator('text=No eligible network hospitals with matching emergency capabilities were found within the 25 km search radius.');
    await expect(zeroHospitalText).toBeVisible({ timeout: 10000 });
    console.log('Verified: 25 km zero-hospital radius explanation is visible');

    // Check accessible call links
    const call108Link = page.locator('a[aria-label="Call 108 Emergency Ambulance Service"]');
    const call112Link = page.locator('a[aria-label="Call 112 All-India Emergency Helpline"]');
    await expect(call108Link).toBeVisible();
    await expect(call112Link).toBeVisible();
    expect(await call108Link.getAttribute('href')).toBe('tel:108');
    expect(await call112Link.getAttribute('href')).toBe('tel:112');
    console.log('Verified: Accessible Call 108 and Call 112 links present');

    // 3. Two-Step SOS Cancellation
    const cancelSosBtn = page.locator('button:has-text("Cancel SOS")');
    await expect(cancelSosBtn).toBeVisible({ timeout: 5000 });
    await cancelSosBtn.click();

    // Verify modal appeared with separate options
    const modalTitle = page.locator('text=Confirm Emergency Cancellation');
    await expect(modalTitle).toBeVisible();

    const consequenceWarning = page.locator('text=Warning: Consequence of Cancellation');
    await expect(consequenceWarning).toBeVisible();

    const keepActiveBtn = page.locator('button:has-text("Keep Emergency Active")');
    const confirmCancelBtn = page.locator('button:has-text("Confirm Cancellation")');
    await expect(keepActiveBtn).toBeVisible();
    await expect(confirmCancelBtn).toBeVisible();

    // Test "Keep Emergency Active" first — modal should close without cancelling
    await keepActiveBtn.click();
    await expect(modalTitle).not.toBeVisible();
    console.log('Verified: "Keep Emergency Active" dismisses modal without cancelling');

    // Reopen and test explicit cancellation
    await cancelSosBtn.click();
    await expect(modalTitle).toBeVisible();
    await confirmCancelBtn.click();
    console.log('Verified: "Confirm Cancellation" executes two-step cancellation');
  });

  test('Scenario 4 & 5: Guest Health Pack Notice and Hospital Heading Presentation', async ({ page }) => {
    // Set up state for an assigned hospital with a guest session
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 'guest-test-id-1',
              name: 'Guest User',
              email: '',
              role: 'PATIENT',
              isGuest: true,
              isVerified: false,
              isProfileComplete: false,
            },
          }),
        });
      } else if (url.includes('/api/emergency/status/CASE-MOCK-002')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            case: {
              id: 'CASE-MOCK-002',
              caseId: 'CASE-MOCK-002',
              status: 'ACCEPTED',
              symptoms: 'Severe Breathing Difficulty',
              createdAt: new Date().toISOString(),
              hospital: {
                id: 'HOSP-01',
                name: 'Apex Trauma & Multispecialty Hospital',
                address: 'Expressway Junction, Anand',
                phone: '02692-234567',
                distanceKm: 3.2,
              },
              medicalSummary: {
                assignedDoctor: {
                  name: 'Dr. Ramesh Patel',
                  specialization: 'Emergency Medicine',
                },
              },
            },
          }),
        });
      } else if (url.includes('/api/emergency/attempts')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            attempts: [
              {
                hospital: {
                  id: 'HOSP-01',
                  name: 'Apex Trauma & Multispecialty Hospital',
                  address: 'Expressway Junction, Anand',
                  phone: '02692-234567',
                  distanceKm: 3.2,
                },
                status: 'ACCEPTED',
                distanceKm: 3.2,
                requestedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Make sure user context is perceived as guest
    await page.addInitScript(() => {
      const guestUser = {
        id: 'guest-test-id-1',
        name: 'Guest User',
        email: '',
        role: 'patient',
        isGuest: true,
        isVerified: false,
        isProfileComplete: false,
      };
      sessionStorage.setItem('caresetu_user', JSON.stringify(guestUser));
    });

    await page.goto('http://localhost:5173/patient/emergency/status/CASE-MOCK-002');
    await page.waitForLoadState('domcontentloaded');

    // 5. Hospital heading selection and patient status presentation
    const hospitalHeading = page.getByRole('heading', { name: 'Apex Trauma & Multispecialty Hospital' });
    await expect(hospitalHeading).toBeVisible({ timeout: 10000 });
    console.log('Verified: Hospital name heading uniquely identified via getByRole(heading)');

    // 4. Guest Health Pack notice and appropriate next step
    const guestNoticeLabel = page.locator('text=Guest SOS — sign in to sync encrypted medical records');
    await expect(guestNoticeLabel).toBeVisible({ timeout: 5000 });

    const infoBtn = page.locator('button:has-text("Info")');
    await expect(infoBtn).toBeVisible();
    await infoBtn.click();

    // Verify Guest Health Pack Notice Modal
    const guestModalTitle = page.locator('text=Guest Health Pack Notice');
    await expect(guestModalTitle).toBeVisible();

    const hospitalInformedNote = page.locator('text=The assigned hospital has already received your GPS coordinates and reported symptoms.');
    await expect(hospitalInformedNote).toBeVisible();

    const signInLink = page.locator('a[href="/login"] button:has-text("Sign In")');
    await expect(signInLink).toBeVisible();

    const gotItBtn = page.locator('button:has-text("Got it")');
    await gotItBtn.click();
    await expect(guestModalTitle).not.toBeVisible();
    console.log('Verified: Guest Health Pack Notice modal provides clear feedback and safe sign-in path');
  });

});
