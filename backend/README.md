# CareSetu Backend Service

The **CareSetu Backend** is an Express.js (v5) microservice built with Node.js and TypeScript/JavaScript. It handles core application logic, database ORM interactions via Prisma, real-time WebSocket communication via Socket.IO, authentication via JWT, SMS notifications via TextBee, email alerts via Brevo, and integration with the Python FastAPI AI microservice.

---

## Technical Stack & Dependencies

- **Runtime Environment:** Node.js (v18+)
- **Web Framework:** Express.js (v5.2)
- **Database ORM:** Prisma ORM (v7.10) & PostgreSQL (with PostGIS spatial extension)
- **Real-time WebSockets:** Socket.IO (v4.8)
- **Authentication:** JSON Web Tokens (jsonwebtoken v9.0) & bcrypt password hashing
- **Input Validation:** Zod schemas (v4.5)
- **Security & Logging:** Helmet security headers, CORS, express-rate-limit, Winston logging, Morgan HTTP logger

---

## Directory Structure

```
backend/
├── prisma/               # Schema definitions, seed files, and migration scripts
├── scratch/              # Operational audit scripts and E2E verification suites
├── src/                  # Core application source code
│   ├── config/           # Environment and service configurations
│   ├── controllers/      # REST API route handler logic
│   ├── data/             # Static medical knowledge datasets for RAG
│   ├── middleware/       # Auth, rate limiting, and error handling middleware
│   ├── models/           # Data models and interfaces
│   ├── providers/        # External service integration clients
│   ├── repositories/     # Database access layer abstractions
│   ├── routes/           # Express router endpoints
│   ├── schemas/          # Zod validation schemas
│   ├── services/         # Core business logic services
│   ├── utils/            # Utility functions and helpers
│   ├── validators/       # Input validation middleware
│   ├── app.js            # Express application setup
│   └── server.js         # HTTP and WebSocket server initialization
└── tests/                # Automated test suites
```

---

## Authentication & Security Architecture

CareSetu implements a multi-layered security architecture for authentication and password management:

1. **Password Security:**
   - **Hashing:** Passwords are hashed using bcrypt with a cost factor of 12 before being saved to PostgreSQL via Prisma.
   - **Zero Plaintext Storage:** Plaintext passwords are never stored, cached, or included in database audit trails.
   - **Password Strength Policy:** Registration and password changes enforce minimum 8 characters, at least one uppercase letter (A-Z), one lowercase letter (a-z), one digit (0-9), and one special character.
   - **Confirmation Mismatch:** Mandatory matching between password and `confirmPassword` fields during signup and password updates.
   - **Response Sanitization:** Passwords and password hashes are stripped from all API outputs (`sanitizeUserResponse`).

2. **Email Security & Anti-Enumeration:**
   - **Normalization:** All email inputs are normalized (`.trim().toLowerCase()`) across registration, login, profile updates, and OTP endpoints to enforce case-insensitive uniqueness.
   - **Anti-Enumeration:** Password reset requests (`/api/auth/forgot-password`) and failed login attempts return uniform, generic messages to prevent user enumeration attacks.

3. **Login Protection & Rate Limiting:**
   - **Rate Limiters:** Built with `express-rate-limit`:
     - Login: 5 attempts per 15 minutes per IP.
     - Registration: 10 registrations per hour per IP.
     - OTP & Forgot Password: 5 requests per 15 minutes per IP.
     - Password Updates: 5 requests per 15 minutes per IP.
   - **Generic Errors:** Returns `Invalid email or password.` for invalid credentials without revealing whether the email or password was wrong.

4. **Password Management & Session Rotation:**
   - Password changes (`/api/settings/password`) require verification of the user's `currentPassword`, validation of `newPassword` strength and confirmation matching.
   - Upon successful password update, a new rotated JWT token is issued and returned to invalidate old sessions on client rotation.

5. **Pending Registration & Abandoned Registration Cleanup:**
   - **Temporary Verification Storage:** OTP verification for Phone (`PHONE_VERIFICATION`) and Email (`EMAIL_VERIFICATION`) is maintained exclusively in the `otps` database table. No permanent `User`, `Patient`, or `Hospital` record is created until the final `Register` form submission.
   - **Expiry Duration:** Configurable via `PENDING_REGISTRATION_EXPIRY_MINUTES` (Default: `15` minutes).
   - **Automated Background Sweeper:** `registration-cleanup.service.js` runs a background task every 60 seconds to automatically delete expired or abandoned registration OTP records exceeding 15 minutes.
   - **Explicit Cancel Endpoint:** `POST /api/auth/cancel-registration` allows frontend "Back" or "Cancel" actions to immediately purge pending registration verification records. Validates that the target identifier does NOT belong to an active registered user to prevent unauthorized user deletion.
   - **Atomic Final Registration:** User account creation and OTP record deletion occur atomically inside a Prisma database transaction (`prisma.$transaction`). Failed registration attempts roll back completely without leaving incomplete permanent user accounts.
   - **Privacy:** Plaintext passwords and OTPs are never stored or logged to stdout. Password hashing uses bcrypt (cost factor 12) and OTP records use bcrypt hashes.

6. **OTP Back Button & 2-Step Dual OTP Forgot Password Architecture:**
   - **Consistent Accessible Back Button:** Standardized "← Back" button across all OTP views (Registration Patient/Doctor/Hospital, Login OTP, Password Reset, Settings Credential Update Modal). Supports keyboard navigation (`Tab`, `Enter`, `Space`) and ARIA labels (`aria-label`).
   - **2-Step Dual OTP Verification Flow:**
     - Step 1: User enters registered Email + Phone number (`POST /api/auth/forgot-password`). Dispatches Brevo Email OTP (`PASSWORD_RESET_EMAIL`) and TextBee SMS OTP (`PASSWORD_RESET_PHONE`). Returns anti-enumeration generic message.
     - Step 2: User verifies Email OTP (`POST /api/auth/verify-otp`).
     - Step 3: User verifies Phone OTP (`POST /api/auth/verify-reset-phone-otp`). Server validates that Email OTP was verified first and issues a signed, 10-minute, single-use `resetToken`.
     - Step 4: User submits new password with `resetToken` (`POST /api/auth/reset-password`). Password is validated and updated in database; underlying verified OTP session records are purged to prevent token reuse.
   - **Clean Back Button Reset:** Clicking "← Back" at any stage revokes pending OTP sessions (`POST /api/auth/cancel-forgot-password`), cleans up timers, preserves non-sensitive typed input fields for editing, and invalidates old OTPs.

---

## Required Environment Variables

Ensure the following variables are declared in `backend/.env`:

```ini
DATABASE_URL="postgresql://user:password@localhost:5432/caresetu?schema=public"
JWT_SECRET="your-secure-random-jwt-secret"
PORT=3000
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
```

---

## Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and set your PostgreSQL connection string and secrets:
   ```ini
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/caresetu?schema=public"
   JWT_SECRET="your-jwt-secret-key"
   PORT=3000
   ```

3. **Database Migration & Seeding:**
   ```bash
   npx prisma db push
   node seed.js
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```

---

## Security Testing Instructions

Execute the automated authentication security test suite covering all 13 core security requirements:

```bash
node tests/auth.security.test.js
```

Or via npm script:
```bash
npm test
```

### Verified Test Cases:
1. Successful registration with valid email & strong password
2. Duplicate email prevention (case-insensitive)
3. Invalid email format rejection
4. Weak password rejection
5. Password mismatch rejection
6. Successful login with valid credentials
7. Incorrect password login rejection (generic error message)
8. Nonexistent email login & generic password reset response (anti-enumeration)
9. Password hash storage (bcrypt verification in database)
10. Password field omission from API responses
11. Login rate limiting enforcement (HTTP 429)
12. Password-change success (with rotated JWT) and failure handling
13. Database immutability verification after failed validation

