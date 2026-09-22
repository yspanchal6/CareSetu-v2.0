# CareSetu Architecture & Design Documentation

Welcome to the central documentation directory for **CareSetu**. This directory contains technical specifications, architectural diagrams, API reference manuals, security audits, and verification reports.

---

## Documentation Navigation Index

### 🏗️ Architecture & Core Specs
- [`architecture.md`](architecture.md) — Comprehensive technical architecture specification.
- [`api.md`](api.md) — RESTful API endpoint specifications and Socket.IO schemas.
- [`architecture/`](architecture/README.md) — Architectural diagrams and design specs.
- [`api/`](api/README.md) — Detailed endpoint documentation by domain.

### 🛡️ Security & Audits
- [`security/`](security/README.md) — Security audits, RBAC policies, and privacy specifications.
- [`healthpack_security_remediation_report.md`](healthpack_security_remediation_report.md) — HealthPack privacy & encryption audit.
- [`otp_credential_update_security_report.md`](otp_credential_update_security_report.md) — OTP security verification report.

### 🤖 Doctor AI & Triage Engine
- [`doctor_ai_final_e2e_verification_report.md`](doctor_ai_final_e2e_verification_report.md) — Final E2E verification report (38/38 tests passed).
- [`doctor_ai_rag_nlp_implementation_report.md`](doctor_ai_rag_nlp_implementation_report.md) — RAG and NLP implementation specification.

### 🗄️ Database & Schemas
- [`database/`](database/README.md) — ER diagrams, schema specifications, and migration logs.

---

## Directory Folder Structure

```
docs/
├── api/                    # API specifications by module
├── architecture/           # System architectural blueprints
├── database/               # Relational data model & PostGIS docs
├── decisions/              # Architecture Decision Records (ADRs)
├── flowcharts/             # Process flow diagrams
├── screenshots/            # UI walkthroughs and test capture evidence
├── security/               # Security policies & encryption docs
├── sequence-diagrams/      # Real-time WebSocket & emergency flow sequences
├── architecture.md         # Master Architecture Document
├── api.md                  # Master API Reference
└── README.md               # Central Documentation Index
```
