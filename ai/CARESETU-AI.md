{
  "name": "CareSetu AI sidecar",
  "description": "Optional containerized AI service (M2): safety engine passthrough, intent classification, LLM text generation with deterministic fallback. Backend keeps its own in-process safety engine, so this container is never on the SOS critical path.",
  "models": [],
  "requirements": {
    "python": ">=3.11",
    "runtime": "FastAPI (uvicorn) + httpx",
    "llm": "Hugging Face Text Generation Inference (optional, via AI_API_KEY)"
  },
  "env": {
    "AI_API_KEY": "Hugging Face token (optional — deterministic fallback otherwise)",
    "HF_MODEL": "Default: mistralai/Mistral-7B-Instruct-v0.3",
    "AI_BASE_URL": "Default: https://api-inference.huggingface.co"
  },
  "endpoints": {
    "GET /health": "liveness",
    "POST /safety": "deterministic red-flag analysis (M1 parity with Node engine)",
    "POST /chat": "safety -> LLM/fallback; returns { reply, intent, ragUsed, modelName }"
  }
}