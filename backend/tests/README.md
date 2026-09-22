# Backend Test Suite Directory (`backend/tests`)

## Purpose
Contains automated unit tests, integration tests, and verification scripts for CareSetu backend microservices.

## Test Scripts Overview
- **`test_doctor_ai_deep_verification.js`:** 25-test unit & service suite covering RAG, OCR bounds, Medical NER, provider timeouts, and HealthPack privacy scoping.
- **`test_doctor_ai_e2e_api.js`:** 13-test live HTTP API suite verifying authentication, Doctor AI chat endpoints, invalid input bounds, rate limiting, and 10-parallel-request concurrency performance.

## Executing Tests
```bash
cd backend
node scratch/test_doctor_ai_deep_verification.js
node scratch/test_doctor_ai_e2e_api.js
```
