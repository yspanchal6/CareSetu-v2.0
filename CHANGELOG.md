# CareSetu Changelog

All notable changes to the **CareSetu** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-18

### Added
- **Doctor AI Health Assistant:** Integrated TF-IDF RAG lexical retrieval (`score >= 0.25`), Medical Named Entity Recognition (NER), multilingual negation parsing (Hindi/Gujarati), and prompt injection defenses.
- **Deterministic Red-Flag Safety Engine:** Non-bypassable emergency override short-circuiting severe cardiac, respiratory, or trauma symptoms directly to Emergency SOS.
- **Emergency SOS Dispatch:** One-touch geolocation SOS trigger, TextBee SMS integration, Socket.IO real-time tracking, and multi-hospital broadcast fallback.
- **HealthPack Encrypted Records:** Medical document upload validation (PDF, JPG, PNG <= 10MB) with magic byte validation and time-bounded consent sharing.
- **OTP Account Credential Update:** Secure email and mobile number update workflow requiring OTP verification before database mutations.
- **Settings & Administrator Module:** Multi-portal settings pages and admin user/hospital blocklist controls.
- **End-to-End Verification Suite:** Deep verification and HTTP E2E test scripts covering 38 total test scenarios.

### Security
- Isolated patient HealthPack data access via JWT-based RBAC scoping.
- Enforced prompt injection scrubbing on user queries and document extractions.
