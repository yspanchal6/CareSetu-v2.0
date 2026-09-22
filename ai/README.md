# CareSetu Python FastAPI AI Sidecar Service (`ai`)

[![FastAPI](https://img.shields.io/badge/FastAPI-v0.115-teal.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Uvicorn](https://img.shields.io/badge/Uvicorn-v0.34-brightgreen.svg)](https://www.uvicorn.org/)

The **CareSetu AI Sidecar** is a Python microservice built with FastAPI and Uvicorn. It provides intent classification, medical Named Entity Recognition (NER), red-flag emergency classification, and LLM chat generation for the Doctor AI assistant.

---

## Safety Architecture (M1 Safety Engine)

> **CRITICAL RULE:** The Node.js Express backend always executes its own in-process deterministic Safety Engine (`backend/src/services/ai-redflag.service.js`) **before** making any call to this sidecar or external LLM APIs. If an emergency red flag is detected, the chatbot short-circuits to Emergency SOS. The LLM never directly triggers an SOS.

This Python sidecar mirrors the red-flag rules (`app/safety/redflag.py`) for validation and offline testing.

---

## Directory Structure

```
ai/
├── app/                  # FastAPI application modules
│   ├── api/              # API router endpoints (/health, /safety, /chat)
│   ├── core/             # Configuration and logging settings
│   ├── rag/              # Local retrieval-augmented generation engine
│   └── safety/           # Deterministic red-flag emergency classifier
├── datasets/             # Synthetic medical datasets and preprocessing pipelines
├── knowledge/            # Curated medical knowledge sources and chunking scripts
├── tests/                # PyTest automated test suites
├── Dockerfile            # Container build specification
├── requirements.txt      # Python dependencies
└── README.md             # Sidecar documentation
```

---

## Setup & Running

### Local Environment Setup
```bash
cd ai
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.api.app:app --host 0.0.0.0 --port 8000 --reload
```

### Docker Container Setup
```bash
docker build -t caresetu-ai .
docker run -p 8000:8000 caresetu-ai
```

---

## API Endpoints

- **`GET /health`** — Liveness health check. Returns `{"status": "ok"}`.
- **`POST /safety`** — Accepts `{"message": "string"}` and returns red-flag analysis result.
- **`POST /chat`** — Accepts `{"message": "string", "intent": "string"}` and returns generated guidance, intent, severity, and emergency flag.

---

## Testing

Run sidecar tests using pytest:
```bash
cd ai
pytest tests/
```