# CareSetu Knowledge Base (RAG)

Two folders:

- **`approved/`** — curated, reviewed markdown content (first aid basics, when to call 108,
  common symptoms). Committed. No third-party licensed text, no private records.
- **`processed/`** — **generated** chunked JSONL (one chunk per `## ` heading), produced by:

    python ai/knowledge/build_knowledge.py

The chat RAG layer (`ai/app/services/llm.py` / backend `ai-client.service.js`) may consume
`processed/knowledge.jsonl` when present; otherwise the deterministic safety engine answers.

Processing rule: never scrape content into this folder; only process what is in `approved/`.

# Clinical Knowledge Base Directory (`ai/knowledge`)

## Overview
Stores curated medical markdown documents and knowledge chunking scripts (`build_knowledge.py`) for the local RAG engine.