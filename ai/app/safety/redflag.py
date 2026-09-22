"""
M1 parity — Deterministic Safety Engine (mirrors backend/src/services/ai-redflag.service.js).

Runs BEFORE any LLM call. The LLM never directly triggers SOS.
"""

RED_FLAG_WORDS = {
    "CARDIAC": {
        "severity": "RED",
        "words": [
            "chest pain", "heart attack", "cardiac arrest", "angina", "pressure in chest",
            "tightness in chest", "pain in left arm", "radiating chest pain", "heart palpitations", "my heart",
            "seene mein dard", "seene me dard", "chhati mein dard", "chhati me dard", "dil mein dard", "dil ka daura", "bahut tez seene ka dard",
            "છાતીમાં દુખાવો", "છાતીમાં ખૂબ દુખાવો", "છાતીમાં ભારે દુખાવો", "હૃદયમાં દુખાવો", "હાર્ટ એટેક",
        ],
    },
    "RESPIRATORY": {
        "severity": "RED",
        "words": [
            "can't breathe", "cannot breathe", "difficulty breathing", "shortness of breath",
            "not breathing", "choking", "asthma attack", "wheezing", "gasping for air",
            "breathless", "struggling to breathe", "suffocating",
            "saans lene mein takleef", "saans lene me takleef", "saans phoolna", "saans nahi aa rahi", "saans lene mein dikkat",
            "શ્વાસ લેવામાં તકલીફ", "શ્વાસ લેવામાં મુશ્કેલી", "શ્વાસ લેવામાં ભારે તકલીફ", "શ્વાસ નથી આવી રહ્યો",
        ],
    },
    "NEUROLOGICAL": {
        "severity": "RED",
        "words": [
            "stroke", "paralysis", "numbness", "slurred speech", "confusion", "seizure",
            "convulsion", "dizziness", "loss of consciousness", "unconscious", "fainted",
            "passed out", "vomiting blood",
            "face drooping", "facial droop", "one side of face drooping", "face is drooping", "arm weakness", "weak arm",
            "cannot move my arm", "can't move my arm", "cannot move one arm", "weakness on one side", "one-sided weakness",
            "sudden weakness", "sudden numbness", "trouble speaking", "difficulty speaking", "cannot speak", "speech suddenly affected",
            "sudden vision loss", "sudden confusion", "loss of balance",
            "lakwa", "chehra tedha", "chehra latakna", "ek haath mein kamzori", "haath nahi hil raha", "bolne mein dikkat", "behosh", "achanak behoshi",
            "મોઢું વાંકડું થવું", "ચહેરો વાંકો થવો", "એક હાથમાં નબળાઈ", "હાથ હલતો નથી", "બોલવામાં તકલીફ", "બેભાન",
        ],
    },
    "TRAUMA": {
        "severity": "ORANGE",
        "words": [
            "accident", "heavy bleeding", "severe bleeding", "bleeding heavily", "head injury",
            "broken bone", "fracture", "deep cut", "severe burn", "drowned", "drowning",
            "overdose", "poisoning", "suicidal", "suicide", "stabbed", "gunshot",
            "bahut zyada khoon", "khoon nahi ruk raha", "gehri chot",
            "ખૂબ લોહી વહી રહ્યું છે", "લોહી બંધ થતું નથી", "ગંભીર ઈજા",
        ],
    },
    "OTHER_HIGH": {
        "severity": "ORANGE",
        "words": [
            "severe pain", "unbearable pain", "allergic reaction", "face swelling",
            "throat swelling", "cannot swallow", "high fever", "very high fever",
            "coughing blood", "blood in vomit", "treated as red",
        ],
    },
}

SYMPTOM_LEXICON = [
    "chest pain", "shortness of breath", "fever", "headache", "cough", "fatigue", "nausea",
    "vomiting", "dizziness", "diarrhea", "sore throat", "rash", "abdominal pain", "back pain",
    "joint pain", "muscle pain", "weakness", "sweating", "chills", "runny nose", "congestion",
]

INTENT_KEYWORDS = {
    "EMERGENCY": ["sos", "emergency", "ambulance", "911", "108", "112", "report emergency"],
    "SYMPTOM_CHECK": ["symptom", "feel", "feeling", "pain", "fever", "cough", "headache", "sick", "ache"],
    "MEDICATION": ["medication", "medicine", "meds", "drug", "dose", "dosage", "prescription", "combine"],
    "FIRST_AID": ["first aid", "wound", "cut", "burn", "bandage", "bleeding", "sprain"],
    "HOSPITAL_SEARCH": ["hospital", "doctor near", "nearest hospital", "clinic", "emergency room"],
    "HEALTH_PACK": ["health pack", "report", "blood test", "lab", "test result"],
    "APPOINTMENT": ["appointment", "book", "schedule", "visit"],
}

SEVERITY_TO_RISK = {"RED": "CRITICAL", "ORANGE": "HIGH", "YELLOW": "MEDIUM", "GREEN": "LOW"}


import re

def is_negated_or_informational(text: str, word: str) -> bool:
    if not text or not word:
        return False
    lower = text.lower()
    idx = lower.find(word.lower())
    if idx == -1:
        return False

    prefix = lower[max(0, idx - 50):idx].strip()

    negation_regex = re.compile(r"\b(no|not|don'?t|does'?n'?t|did'?n'?t|without|free of|negative for|deny|denies|denying|ruled out)\b", re.IGNORECASE)
    if negation_regex.search(prefix):
        return True

    info_regex = re.compile(r"\b(what is|what are|what does|what causes|meaning of|definition of|explain|tell me about|asking about|asking what|information on|define|learn about|read about|difference between)\b", re.IGNORECASE)
    if info_regex.search(prefix):
        return True

    if "?" in lower and re.match(r"^(what|why|how|can|could|tell me)\b", lower.strip(), re.IGNORECASE):
        if not re.search(r"\b(i have|i am having|i'm having|my|experiencing|suffering from)\b", prefix, re.IGNORECASE):
            return True

    return False


def analyze(text: str):
    """Return a deterministic, LLM-free safety analysis of a chat message."""
    lower = text.lower()
    detected_words = []
    emergency_signals = []
    severity = "GREEN"

    for category, cfg in RED_FLAG_WORDS.items():
        hits = [w for w in cfg["words"] if w in lower]
        hit_found = False
        for word in hits:
            if is_negated_or_informational(text, word):
                continue
            detected_words.append(word)
            emergency_signals.append(f"RED_FLAG:{category}:{word}")
            if cfg["severity"] == "RED":
                severity = "RED"
            elif severity != "RED":
                severity = "ORANGE"
            hit_found = True
            break
        if hit_found:
            break

    symptoms = [s for s in SYMPTOM_LEXICON if s in lower]
    intent = "GENERAL_HEALTH"
    for name, keys in INTENT_KEYWORDS.items():
        if any(k in lower for k in keys):
            intent = name
            break

    is_emergency = severity in ("RED", "ORANGE")
    return {
        "is_emergency": is_emergency,
        "severity": severity,
        "risk_level": SEVERITY_TO_RISK.get(severity, "UNKNOWN"),
        "detected_words": detected_words,
        "emergency_signals": emergency_signals,
        "symptoms": symptoms,
        "intent": intent,
    }