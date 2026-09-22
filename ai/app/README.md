# FastAPI Application Core (`ai/app`)

## Overview
Contains the FastAPI router modules, red-flag safety classifier, RAG retrieval engine, and API configuration.

## Key Modules
- **`app/api/app.py`:** FastAPI application instantiation, CORS setup, and route inclusions.
- **`app/safety/redflag.py`:** Deterministic Python red-flag emergency symptom classifier.
- **`app/rag/`:** Local knowledge retrieval functions.
