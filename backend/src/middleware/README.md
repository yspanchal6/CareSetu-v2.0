# Backend Middleware Directory (`backend/src/middleware`)

## Purpose
Provides request interceptors for authentication, authorization (RBAC), input validation, rate limiting, and global error handling.

## Key Middleware Components
- **`auth.middleware.js`:** Verifies incoming `Authorization: Bearer <token>` JWT headers and populates `req.user`.
- **`rbac.middleware.js`:** Enforces role-based access restrictions (`PATIENT`, `HOSPITAL`, `DOCTOR`, `ADMINISTRATOR`).
- **`rate-limiter.middleware.js`:** Implements `express-rate-limit` guards on login and Doctor AI chat endpoints.
- **`error.middleware.js`:** Catches unhandled exceptions, sanitizes stack traces in production, and formats standardized HTTP error responses.
