#!/usr/bin/env python3
"""
Focused Slice 12 test — dataset pipeline stages.

Run:  python tests/test_dataset_pipeline.py
(no third-party dependencies needed)
"""

import json
import re
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_AI_ROOT = _HERE.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from datasets.generate_synthetic import generate
from datasets.pipeline import (
    validate, clean, deidentify, normalize, split_records, run_pipeline,
)

passed = 0
failed = 0

def ok(name, cond, extra=None):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name} — {extra}")

print("═══ 1. VALIDATION ═══\n")
bad = {"id": "", "text": " ", "intent": "BOGUS", "risk_level": "MAXIMUM", "emergency_signal": "yes"}
ok("rejects malformed record", len(validate(bad)) >= 4, validate(bad))

good = {"id": "x", "text": "I have a headache", "intent": "SYMPTOM_CHECK", "risk_level": "LOW", "emergency_signal": False, "symptoms": ["headache"]}
ok("accepts well-formed record", validate(good) == [], validate(good))

print("\n═══ 2. CLEAN + DE-IDENTIFY ═══\n")
dirty = {"id": "x", "text": "  CALL  +91 9876543210  now  ", "intent": "SYMPTOM_CHECK", "risk_level": "LOW", "emergency_signal": False, "_pii_injected": True}
c = clean(dirty)
ok("cleaning collapses whitespace", c["text"] == "CALL +91 9876543210 now", repr(c["text"]))
dt = deidentify(c)
ok("de-identify scrubs phone number", "+91" not in dt["text"] and "9876543210" not in dt["text"] and "[PHI]" in dt["text"], repr(dt["text"]))
ok("de-identify counts the scrub", dt["phi_scrubbed"] >= 1, dt["phi_scrubbed"])

em = {"text": "mail me at joe@example.com and 1234 5678 9012", "id": "e", "intent": "GENERAL_HEALTH", "risk_level": "LOW", "emergency_signal": False}
de = deidentify(em)
ok("de-identify scrubs email + Aadhaar-like", "@" not in de["text"] and "1234" not in de["text"], repr(de["text"]))

print("\n═══ 3. NORMALIZE ═══\n")
n = normalize({"id": "n", "text": "text", "intent": "symptom_check", "risk_level": "low", "emergency_signal": False, "symptoms": [" Headache ", "fever"]})
ok("normalizes enums to upper", n["intent"] == "SYMPTOM_CHECK" and n["risk_level"] == "LOW")
ok("canonicalizes symptoms", n["symptoms"] == ["headache", "fever"], n["symptoms"])

print("\n═══ 4. SPLIT (stratified) ═══\n")
recs = generate(count=400)
ok("generator is deterministic & seeded", recs[0]["id"] == "syn-000000" and recs[0]["text"] == recs[0]["text"])
train, val, test = split_records(recs)
ok("split sizes ~80/10/10", abs(len(train) - 320) <= 5 and abs(len(val) - 40) <= 5 and abs(len(test) - 40) <= 5, (len(train), len(val), len(test)))
missing = [i for i in ("EMERGENCY", "SYMPTOM_CHECK", "MEDICATION") if i not in {r["intent"] for r in test}]
ok("stratified: all key intents present in test", len(missing) == 0, missing)

print("\n═══ 5. FULL PIPELINE + EVALUATION ═══\n")
report = run_pipeline(size=500)
ok("pipeline wrote processed + 3 splits", report["splits"]["train"] > 0 and report["splits"]["test"] > 0, report["splits"])
ok("no records dropped for being invalid", report["invalid_records_dropped"] == 0, report["invalid_records_dropped"])
ok("phi scrubs happened", report["phi_scrubbed_total"] > 0, report["phi_scrubbed_total"])
ev = report["evaluation"]
ok("evaluation ran (tp+tn+fp+fn == test size)", ev["total"] == report["splits"]["test"], (ev["total"], report["splits"]["test"]))
ok("safety engine agrees with labels at high accuracy (>=0.8)", ev["accuracy"] >= 0.8, ev["accuracy"])
ok("recall on emergencies is high (>=0.85)", ev["recall"] >= 0.85, ev["recall"])

# No PHI may leak into final artifacts
print("\n═══ 6. NO PHI LEAK CHECK ═══\n")
phi_pattern = re.compile(r"(\+91[0-9\s-]{9,}|\b\d{4}[- ]?\d{4}[- ]?\d{4}\b|[\w.\-]+@[\w.\-]+\.[a-z]{2,})", re.IGNORECASE)
leaks = 0
for split_name in ("train", "validation", "test"):
    f = Path(_AI_ROOT) / "datasets" / split_name / f"{split_name}.jsonl"
    for line in f.open(encoding="utf-8"):
        rec = json.loads(line)
        if phi_pattern.search(rec.get("text", "")):
            leaks += 1
            print(f"   ⚠ PHI leak in {split_name}: {rec['text']}")
ok("no PHI in any generated split", leaks == 0, f"{leaks} leaks")

print(f"\n═══ RESULT: {passed} passed, {failed} failed ═══\n")
sys.exit(1 if failed else 0)