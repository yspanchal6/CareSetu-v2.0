# CareSetu — Git & CI/CD Development Workflow

This document outlines the standard, secure development, testing, and deployment workflow for all future feature implementations and bug fixes in the CareSetu platform.

---

## 1. Branching & Feature Workflow

Always keep the `main` branch stable and deployable. Never work directly on `main` for new features or multi-step refactors.

### Step-by-Step Development Cycle

1. **Update `main` branch:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create a dedicated topic branch:**
   ```bash
   git checkout -b feature/your-feature-name
   # Or for bug fixes:
   git checkout -b fix/issue-description
   ```

3. **Implement Changes & Audit Code:**
   * Keep modifications modular, clean, and typed.
   * Preserve existing API contracts, database relations, and security middleware.
   * Never hardcode API keys, secrets, JWT tokens, or credentials in source code.

4. **Run Local Automated Verification:**
   * **Backend Security & Integration Tests:**
     ```bash
     node backend/tests/auth.security.test.js
     node backend/tests/emergency-timeout-and-flags.test.js
     node backend/tests/url-token.security.test.js
     ```
   * **Frontend Type-Check & Production Build:**
     ```bash
     cd frontend
     npm run build
     ```

5. **Format & Whitespace Audit:**
   ```bash
   git diff --check
   ```

6. **Stage & Commit Changes:**
   ```bash
   git status
   git add <reviewed-files>
   git commit -m "feat(module): concise description of feature"
   ```

7. **Push Topic Branch & Open Pull Request:**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Review, Merge, & Deploy:**
   * Review diffs on GitHub.
   * Merge into `main` after CI checks pass.

---

## 2. Environment Variables & Security Safeguards

Required environment variables (set in host environment / GitHub Secrets — **never commit `.env` files**):

### Backend (`backend/.env`)
* `PORT`
* `DATABASE_URL` (PostgreSQL / PostGIS connection string)
* `JWT_SECRET`
* `URL_ENCRYPTION_SECRET` (32-byte secret for AES-256-GCM payload encryption)
* `HOSPITAL_RESPONSE_TIMEOUT_SECONDS` (Default: `20`)
* `BREVO_API_KEY` (Optional email OTP dispatch)
* `TEXTBEE_API_KEY` & `TEXTBEE_DEVICE_ID` (Optional SMS dispatch)

### Frontend (`frontend/.env`)
* `VITE_API_BASE_URL`
* `VITE_FIREBASE_VAPID_KEY` (Web Push Notifications)

---

## 3. GitHub Actions & CI/CD Pipeline

CareSetu utilizes GitHub Actions for continuous integration and automated frontend deployment:

* **Workflow Config:** `.github/workflows/deploy.yml` (or `static.yml`)
* **Trigger:** Pushes to `main`
* **Automated Tasks:**
  1. Installs Node.js dependencies (`npm ci`).
  2. Runs TypeScript type-checks (`tsc -b`).
  3. Bundles production SPA assets using Vite (`npm run build`).
  4. Deploys client assets to GitHub Pages or static web host.

---

## 4. Rollback & Emergency Recovery Protocol

In the event of a production issue:

1. **Revert Commit:**
   ```bash
   git revert <bad-commit-hash>
   git push origin main
   ```
2. **Re-run Deployment Pipeline:** GitHub Actions automatically redeploys the stable reverted commit.
3. **Database Safeguard:** Never execute destructive SQL (`DROP TABLE`, `TRUNCATE`) without a full database snapshot backup.
