# Static Data & Knowledge Datasets (`backend/src/data`)

## Purpose
Stores static JSON datasets and medical knowledge bases used locally by backend services.

## Key Datasets
- **`medical-knowledge.json`:** Curated clinical knowledge chunks covering symptoms, first aid procedures, cardiovascular red flags, and disease descriptions. Used by [`ai-rag.service.js`](../services/ai-rag.service.js) for lexical TF-IDF vector retrieval.
