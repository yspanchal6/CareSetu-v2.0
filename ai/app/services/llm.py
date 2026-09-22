"""
Optional LLM client. Calls Hugging Face Text Generation Inference API
(or an OpenAI-compatible endpoint via AI_BASE_URL) when AI_API_KEY is set.

Returns (reply_text, rag_used, model_name).
"""

import os
import httpx

HF_API_KEY = os.getenv("AI_API_KEY", "")
HF_MODEL = os.getenv("HF_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")
HF_BASE_URL = os.getenv("AI_BASE_URL", "https://api-inference.huggingface.co")
TIMEOUT = 8.0

SYSTEM = (
    "You are CareSetu Doctor AI, a cautious Indian healthcare assistant. "
    "Answer briefly in plain language. If the user describes an emergency, "
    "tell them to use Report Emergency or call 108/112 immediately. "
    "Always end with a short disclaimer that you are AI guidance only and a "
    "doctor must confirm any diagnosis. Never invent lab values or prescriptions."
)


def call_llm(user_text: str) -> tuple[str, bool, str]:
    """Call HF TGI and return (reply, rag_used=False, model_name). Raises on failure."""
    if not HF_API_KEY:
        raise RuntimeError("AI_API_KEY not set")

    url = HF_BASE_URL.rstrip("/") + ("/v1/chat/completions" if "openai" in HF_BASE_URL or "api.openai.com" in HF_BASE_URL else "")
    # HF Inference API uses POST to /models/<model> with {inputs, parameters}
    # For OpenAI-compatible: use chat completions.
    if "openai" in HF_BASE_URL or "api.openai.com" in HF_BASE_URL:
        resp = httpx.post(
            url,
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            json={
                "model": HF_MODEL,
                "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_text}],
                "temperature": 0.7,
                "max_tokens": 500,
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return content.strip(), False, data.get("model", HF_MODEL)
    else:
        # HF Text Generation Inference
        resp = httpx.post(
            f"{HF_BASE_URL.rstrip('/')}/{HF_MODEL}",
            headers={"Authorization": f"Bearer {HF_API_KEY}"},
            json={
                "inputs": f"<s>[INST] {SYSTEM}\n\n{user_text} [/INST]",
                "parameters": {"temperature": 0.7, "max_new_tokens": 500},
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        generated = data[0].get("generated_text", "")
        # Strip the prompt prefix if present
        if "[/INST]" in generated:
            generated = generated.split("[/INST]")[-1].strip()
        return generated.strip() if generated.strip() else None, False, HF_MODEL