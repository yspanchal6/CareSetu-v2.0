# Input Validation Middleware Directory (`backend/src/validators`)

## Purpose
Express middleware components that wrap Zod schemas to sanitize and validate incoming request payloads before reaching route controllers.

## Responsibilities
- Intercept invalid request bodies and return HTTP 400 Bad Request responses with detailed field validation messages.
- Prevent malformed JSON or prompt injection payloads from entering service layers.
