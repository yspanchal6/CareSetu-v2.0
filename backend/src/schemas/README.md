# Zod Validation Schemas Directory (`backend/src/schemas`)

## Purpose
Defines Zod type-safe validation schemas for parsing and sanitizing incoming HTTP request parameters, bodies, and query strings.

## Key Schemas
- **`auth.schema.js`:** Validates user registration payloads, login credentials, and OTP update formats.
- **`emergency.schema.js`:** Validates latitude/longitude bounds, emergency types, and notes.
- **`chat.schema.js`:** Validates Doctor AI query strings (maximum 2,000 characters) and HealthPack inclusion flags.
- **`document.schema.js`:** Validates uploaded file MIME types, file sizes (<= 10MB), and consent parameters.
