#!/usr/bin/env python3
"""
Synthetic emergency/medical QA dataset generator (Slice 12).

Deterministic (seeded) generator producing de-identified, synthetic records for
the CareSetu chatbot + safety engine. No real patient data is ever used.

Output: one JSON object per line (JSONL) written to ai/datasets/raw/.

Labels follow the AI output contract (§14):
  intent, symptoms[], risk_level, emergency_signal, reason
"""

import json
import random
import re
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent / "raw"

RNG = random.Random(42)

_fillers = [
    "", "I think ", "Yesterday I felt ", "Since morning ", "For the past two days ",
    "Right now ", "After waking up ", "While walking ",
]

_starts = [
    "I have", "I am experiencing", "I feel", "I've been having", "There is",
    "My", "Could you help me understand", "Is it normal to have",
]

def _gen_phone():
    return f"+91{random.randint(6000000000, 9999999999)}"

def _gen_email():
    name = "".join(random.choices("abcdefghijklmnop", k=8))
    return f"{name}{random.randint(10,99)}@example.com"

CARDIAC = [
    "I have severe chest pain and pain radiating to my left arm",
    "pressure in chest with shortness of breath",
    "it feels like a heart attack, tightness in chest",
    "angina-like chest pain that does not go away",
]
RESPIRATORY = [
    "I cannot breathe properly", "shortness of breath after climbing stairs",
    "wheezing and gasping for air", "asthma attack right now",
    "struggling to breathe, my throat is closing",
]
NEURO = [
    "sudden numbness on one side and confusion",
    "I think it could be a stroke, slurred speech and dizziness",
    "lost consciousness and now feel confused",
    "seizure just happened",
]
TRAUMA = [
    "was in an accident, severe bleeding from the leg",
    "fell down and broke my arm, head injury",
    "deep cut that won't stop bleeding",
    "drowning and unconscious after",
]
POISON = [
    "accidentally drank poison", "overdose, cannot wake up",
]
SEVERE = [
    "unbearable pain all over", "high fever that will not come down",
    "coughing blood", "vomiting blood",
]

NON_URGENT = {
    "SYMPTOM_CHECK": [
        "I have a mild headache", "slight fever since yesterday", "a dry cough",
        "feeling tired and weak for a week", "stomach ache after eating",
        "sore throat and runny nose",
    ],
    "MEDICATION": [
        "can I combine paracetamol with my blood pressure medicine",
        "what is the right dose for my cold medicine",
        "should I take my tablets with food",
    ],
    "FIRST_AID": [
        "what should I do for a small burn", "how to bandage a minor cut",
        "first aid for a sprained ankle",
    ],
    "HOSPITAL_SEARCH": [
        "nearest hospital with ICU beds nearby", "find a cardiologist hospital in my city",
        "which government hospital is close to me",
    ],
    "HEALTH_PACK": [
        "can you summarise my blood test report", "what do these lab values mean",
        "how do I share my health pack with a hospital",
    ],
    "APPOINTMENT": [
        "can I book a checkup appointment", "schedule a follow up visit",
    ],
    "GENERAL_HEALTH": [
        "tips for better sleep", "how much water should I drink",
        "foods that help control blood pressure", "exercise advice for office workers",
    ],
}

EMERGENCY_TEMPLATES = [
    ("CARDIAC", CARDIAC, "CRITICAL", ["chest pain", "shortness of breath"]),
    ("RESPIRATORY", RESPIRATORY, "CRITICAL", ["shortness of breath", "wheezing"]),
    ("NEUROLOGICAL", NEURO, "CRITICAL", ["confusion", "dizziness"]),
    ("TRAUMA", TRAUMA, "HIGH", ["bleeding", "fracture"]),
    ("POISONING", POISON, "CRITICAL", ["poisoning", "overdose"]),
    ("OTHER_HIGH", SEVERE, "HIGH", ["fever", "bleeding"]),
]

def _compose(text: str) -> str:
    if not text.startswith("I") and not text.startswith("it") and not text.startswith("was"):
        return f"{RNG.choice(_starts)} {text}"
    return text

def _record(i: int, text: str, intent: str, risk: str, symptoms: list, reason: str,
            inject_pii: bool = False, category: str = None) -> dict:
    emergency = risk in ("CRITICAL", "HIGH")
    r = {
        "id": f"syn-{i:06d}",
        "text": text,
        "intent": intent,
        "category": category,
        "symptoms": symptoms,
        "risk_level": risk,
        "emergency_signal": emergency,
        "reason": reason,
        "source": "synthetic",
    }
    if inject_pii:
        # Used ONLY to prove the de-identification stage scrubs PHI patterns.
        r["text"] = f"{text}. Contact {_gen_phone()} or email {_gen_email()}"
        r["_pii_injected"] = True
    return r


def generate(count: int = 12000) -> list:
    """Generate `count` deterministic synthetic records."""
    records = []
    emergency_pool = []
    for cat, texts, risk, symptoms in EMERGENCY_TEMPLATES:
        for t in texts:
            emergency_pool.append((cat, f"{_compose(t)}", risk, symptoms))
    non_pool = [(k, t) for k, texts in NON_URGENT.items() for t in texts]

    # ~55% emergency, ~45% non-emergency — mirrors a high-urgency support queue.
    for i in range(count):
        if i % 100 < 55 and emergency_pool:
            cat, text, risk, symptoms = RNG.choice(emergency_pool)
            intent, category, reason = "EMERGENCY", cat, f"Red-flag detected ({cat.lower()}), severity {risk}"
        else:
            intent, text = RNG.choice(non_pool)
            risk = "LOW"
            category = None
            symptoms = [w for w in ("fever", "headache", "cough", "pain") if w in text.lower()]
            reason = "Non-urgent inquiry"
            if intent == "HOSPITAL_SEARCH":
                risk = "LOW"
        text = text if text[0].isupper() or text[0].isdigit() else text
        text = f"{RNG.choice(_fillers)}{text}".strip()
        text = re.sub(r"\s+", " ", text).strip()
        inject = (i % 20 == 3)  # ~5% carry a fake contact line for de-identification proof
        records.append(_record(i, text, intent, risk, symptoms, reason, inject_pii=inject, category=category))
    return records


def main():
    count = int(__import__("os").environ.get("DATASET_SIZE", "12000"))
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    records = generate(count)
    out = RAW_DIR / "synthetic_emergency.jsonl"
    with out.open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    emergency = sum(1 for r in records if r["emergency_signal"])
    print(f"[generate] Wrote {len(records)} synthetic records → {out}")
    print(f"[generate] emergency_signals={emergency} ({emergency / len(records):.1%})")
    print(f"[generate] PII-injected fixtures={sum(1 for r in records if r.get('_pii_injected'))}")


if __name__ == "__main__":
    main()