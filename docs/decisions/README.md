# CareSetu Architecture Decision Records (ADRs)

## Folder Overview
This directory records significant technical and design decisions made during CareSetu development.

## Summary of Decisions
- **ADR-001: Lexical TF-IDF Vector RAG for Doctor AI:** Chosen over external cloud vector databases for zero-dependency local execution speed and deterministic score thresholding.
- **ADR-002: Deterministic M1 Safety Override:** Implemented to enforce immediate SOS escalation for active red flags, bypassing LLM generation.
- **ADR-003: PostGIS Spatial Indexing for Hospital Matching:** Utilized PostgreSQL PostGIS extension for accurate Haversine spatial radius matching.
