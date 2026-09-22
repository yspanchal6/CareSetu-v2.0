"""
Orchestration: try the LLM first, fall back to a deterministic responder.
Emergency is always short-circuited by the caller before reaching here.
"""

from ..services.llm import call_llm, HF_API_KEY

KNOWLEDGE = {
    "fever": "For fever, stay hydrated, rest, and monitor temperature. See a doctor if the fever stays above 102°F or lasts more than 48 hours.",
    "headache": "Headaches often improve with hydration, rest, and reducing screen time. Seek urgent care if it appears suddenly after injury or comes with neck stiffness or slurred speech.",
    "cough": "Coughs from a viral infection usually settle in 1-2 weeks. Get medical review if there is coughing up blood, breathlessness, or a fever that will not break.",
    "chest": "Any new or worsening chest pain or tightness needs urgent evaluation -- use Report Emergency or call 108 without delay.",
    "breath": "Worsening breathlessness is an emergency -- use Report Emergency or call 108.",
    "dizzy": "Occasional dizziness can be from dehydration or low blood sugar. Sit down, hydrate, and eat. Repeated or passing-out dizziness needs a medical review.",
    "fatigue": "Persistent fatigue has many causes -- sleep, anemia, thyroid, or stress. A simple blood panel can help narrow it down.",
    "rash": "A mild rash with fever is often viral. Urgent care is needed for throat/face swelling, spreading bruises, or a rash that does not fade under pressure.",
    "medication": "Medication questions should be verified with a pharmacist or doctor. Never stop or combine prescription medicines without professional advice.",
}

FALLBACK = (
    "Thanks for sharing that. If your symptoms change or worsen, use Report Emergency "
    "or call 108 immediately. I can help structure a note for your doctor or look up "
    "basic first-aid guidance. I assist -- a qualified doctor makes the final call."
)


def deterministic(text: str):
    lower = text.lower()
    for key, snippet in KNOWLEDGE.items():
        if key in lower:
            return snippet, True
    return FALLBACK, False


def generate_reply(text: str, analysis: dict):
    """Return (reply, rag_used, model_name). LLM > deterministic."""
    if HF_API_KEY:
        try:
            reply, rag, model = call_llm(text)
            return reply, rag, model
        except Exception as exc:  # noqa: BLE001 - any failure falls back gracefully
            print(f"[AI sidecar] LLM failed, falling back: {exc}")

    reply, rag = deterministic(text)
    if analysis.get("intent") == "MEDICATION":
        reply = "Medication questions should always be checked with your pharmacist or doctor. " + reply
    return reply, rag, None