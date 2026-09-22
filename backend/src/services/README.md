# Core Business Services Directory (`backend/src/services`)

## Purpose
Encapsulates all core application business logic, domain processing, triage rules, and background workflows.

## Key Services
- **`ai-redflag.service.js`:** Multilingual (English, Hindi, Gujarati, Hinglish) M1 emergency safety engine that checks user queries for life-threatening red-flag symptoms.
- **`ai-rag.service.js`:** Lexical TF-IDF vector retrieval engine for Doctor AI. Tokenizes query terms, normalizes medical synonyms, computes cosine similarity over knowledge chunks, and enforces `score >= 0.25`.
- **`ai-nlp.service.js`:** Medical Named Entity Recognition (NER) service for identifying positive/negated symptoms, durations, severities, and medications.
- **`ai-ocr.service.js`:** Sanitizes uploaded document text, validates MIME bounds (PDF, JPG, PNG <= 10MB), and manages scanned image fallback reporting.
- **`ai-client.service.js`:** Orchestrates Doctor AI queries across Red-Flag safety checks, RAG context retrieval, HealthPack inclusions, and LLM sidecar requests.
- **`emergency.service.js`:** Handles PostGIS geospatial hospital matching, multi-hospital broadcast dispatch, timeout management, and TextBee SMS transmission.
- **`medical-document.service.js`:** Encrypts and manages patient HealthPack records, magic byte validation, and time-bounded hospital access consent grants.
- **`otp.service.js`:** Generates and verifies one-time passwords for email and mobile number updates.
