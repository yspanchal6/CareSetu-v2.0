"""
CareSetu AI Sidecar (M2) — Safety Engine + optional LLM chat generation.

The Node backend always keeps its own in-process Safety Engine (M1) on the
SOS critical path. This sidecar provides an independent LLM-backed layer
for richer chat responses and intent classification when called via AI_SERVICE_URL.
"""

import os
from fastapi import FastAPI
from pydantic import BaseModel
from ..safety.redflag import analyze
from ..orchestrator.chat import generate_reply

app = FastAPI(title="CareSetu AI Sidecar", version="0.1.0")

HF_API_KEY = os.getenv("AI_API_KEY", "")
HF_MODEL = os.getenv("HF_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")
HF_BASE_URL = os.getenv("AI_BASE_URL", "https://api-inference.huggingface.co")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "llm_configured": bool(HF_API_KEY),
        "model": HF_MODEL if HF_API_KEY else None,
    }


class ChatRequest(BaseModel):
    message: str
    intent: str | None = None
    severity: str | None = None


@app.post("/safety")
def safety(payload: ChatRequest):
    return analyze(payload.message)


@app.post("/chat")
def chat(payload: ChatRequest):
    analysis = analyze(payload.message)
    if analysis["is_emergency"]:
        return {
            "is_emergency": True,
            "reply": None,
            "rag_used": False,
            "model_name": None,
            "intent": "EMERGENCY",
            "severity": analysis["severity"],
            "detected_words": analysis["detected_words"],
        }

    reply, rag_used, model_name = generate_reply(payload.message, analysis)
    return {
        "is_emergency": False,
        "reply": reply,
        "rag_used": rag_used,
        "model_name": model_name,
        "intent": analysis["intent"],
        "severity": analysis["severity"],
        "detected_words": analysis["detected_words"],
    }