#!/usr/bin/env python3
"""
Dataset pipeline (Slice 12) — flows per prompt §13:

  Raw → Validation → Cleaning → De-identification → Normalization
      → Train/Validation/Test split → Evaluation → AI integration

Rules honoured:
- Synthetic data only, never real patient records.
- Raw/processed keeps separate folders.
- Evaluation runs the deterministic Safety Rule Engine (ai/app/safety/redflag.py)
  against the dataset's emergency_signal labels — no LLM involved.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_AI_ROOT = _HERE.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

RAW = _HERE / "raw"
PROCESSED = _HERE / "processed"
TRAIN = _HERE / "train"
VALIDATION = _HERE / "validation"
TEST = _HERE / "test"

VALID_RISK = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
VALID_INTENT = {
    "EMERGENCY", "SYMPTOM_CHECK", "MEDICATION", "FIRST_AID",
    "HOSPITAL_SEARCH", "HEALTH_PACK", "APPOINTMENT", "GENERAL_HEALTH",
}

PHI_PATTERNS = [
    re.compile(r"\+?91[\s-]?[6-9]\d{9}"),          # Indian mobile numbers
    re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b"),   # Aadhaar-like 12-digit
    re.compile(r"[\w.\-]+@[\w.\-]+\.\w{2,}"),       # emails
    re.compile(r"(?i)\b(mr|mrs|ms|dr|smt|shri)\.?\s+[a-z]+"),  # name prefixes
]

def validate(record: dict) -> list:
    """Return a list of validation errors (empty = valid)."""
    errors = []
    if not isinstance(record.get("id"), str):
        errors.append("missing id")
    if not isinstance(record.get("text"), str) or not record["text"].strip():
        errors.append("missing/empty text")
    if record.get("intent") not in VALID_INTENT:
        errors.append(f"invalid intent: {record.get('intent')}")
    if record.get("risk_level") not in VALID_RISK:
        errors.append(f"invalid risk_level: {record.get('risk_level')}")
    if not isinstance(record.get("emergency_signal"), bool):
        errors.append("emergency_signal must be a boolean")
    if "symptoms" in record and not isinstance(record["symptoms"], list):
        errors.append("symptoms must be a list")
    return errors


def clean(record: dict) -> dict:
    """Normalise text whitespace/case, strip filler noise; returns a copy."""
    import copy
    r = copy.deepcopy(record)
    text = r.get("text", "").strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    # Drop the synthetic injection marker AFTER it has served its purpose; the
    # contact details are scrubbed in the de-identification stage.
    r["text"] = text
    r.pop("_pii_injected", None)
    return r

def deidentify(record: dict) -> dict:
    """Scrub PHI patterns (phones, Aadhaar-likes, emails, name prefixes)."""
    record = dict(record)
    text = record["text"]
    scrubbed = 0
    for pat in PHI_PATTERNS:
        text, n = pat.subn("[PHI]", text)
        scrubbed += n
    record["text"] = text
    record["phi_scrubbed"] = scrubbed
    return record

def normalize(record: dict, keep_provenance: bool = False) -> dict:
    """Canonicalize enums and symptoms; drop pipeline-internal fields."""
    r = dict(record)
    r["risk_level"] = r["risk_level"].upper()
    r["intent"] = r["intent"].upper()
    r["symptoms"] = [s.strip().lower() for s in (r.get("symptoms") or []) if s.strip().lower()]
    r["phi_scrubbed"] = r.pop("phi_scrubbed", 0)
    r["emergency_signal"] = bool(r["emergency_signal"])
    r.pop("_pii_injected", None)
    if not keep_provenance:
        r.pop("source", None)
    return r


def split_records(records, train_frac=0.8, val_frac=0.1, seed=42):
    """Stratified split by intent (deterministic)."""
    import random
    rng = random.Random(seed)
    by_intent = {}
    for r in records:
        by_intent.setdefault(r["intent"], []).append(r)

    train, val, test = [], [], []
    for intent, items in by_intent.items():
        rng.shuffle(items)
        n = len(items)
        n_train = int(n * train_frac)
        n_val = int(n * val_frac)
        train.extend(items[:n_train])
        val.extend(items[n_train:n_train + n_val])
        test.extend(items[n_train + n_val:])
    rng.shuffle(train)
    return train, val, test


def _write_jsonl(path: Path, records):
    with path.open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n")


def evaluate(records):
    """Run the deterministic Safety Engine on each text; compare with labels."""
    from app.safety.redflag import analyze  # M1 parity

    tp = tn = fp = fn = 0
    for r in records:
        pred = analyze(r["text"])["is_emergency"]
        gold = r["emergency_signal"]
        if pred == gold and pred:
            tp += 1
        elif pred == gold:
            tn += 1
        elif pred and not gold:
            fp += 1
        else:
            fn += 1
    total = tp + tn + fp + fn
    acc = (tp + tn) / total if total else 0.0
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) else 0.0
    return {"total": total, "tp": tp, "tn": tn, "fp": fp, "fn": fn,
            "accuracy": round(acc, 4), "precision": round(prec, 4),
            "recall": round(rec, 4), "f1": round(f1, 4)}


def run_pipeline(size=12000):
    """Execute the full pipeline; returns a report dict."""
    from datasets.generate_synthetic import generate

    for d in (RAW, PROCESSED, TRAIN, VALIDATION, TEST):
        d.mkdir(parents=True, exist_ok=True)

    # 1. GENERATE synthetic raw data
    raw_records = generate(count=size)
    stats = {"generated": len(raw_records)}

    # 2. VALIDATE
    invalid = 0
    valid_records = []
    for r in raw_records:
        errs = validate(r)
        if errs:
            invalid += 1
            continue
        valid_records.append(r)
    stats["invalid_records_dropped"] = invalid

    # 3. CLEAN → 4. DE-IDENTIFY → 5. NORMALIZE
    processed = []
    for r in valid_records:
        r = clean(r)
        r = deidentify(r)
        processed.append(normalize(r))
    stats["phi_scrubbed_total"] = sum(r["phi_scrubbed"] for r in processed)

    _write_jsonl(PROCESSED / "synthetic_processed.jsonl", processed)

    # 6. SPLIT
    train, val, test = split_records(processed)
    _write_jsonl(TRAIN / "train.jsonl", train)
    _write_jsonl(VALIDATION / "validation.jsonl", val)
    _write_jsonl(TEST / "test.jsonl", test)
    stats["splits"] = {"train": len(train), "validation": len(val), "test": len(test)}

    # 7. EVALUATION (deterministic engine vs labels — no LLM)
    eval_report = evaluate(test)
    stats["evaluation"] = eval_report
    stats["label_distribution"] = dict(Counter(r["emergency_signal"] for r in processed))
    stats["intent_distribution"] = dict(Counter(r["intent"] for r in processed))

    # 8. AI INTEGRATION — write eval report for other services to consume
    _write_jsonl(PROCESSED / "evaluation_report.jsonl", [{"pipeline_version": 1, **eval_report}])

    return stats


def main():
    size = int(__import__("os").environ.get("DATASET_SIZE", "12000"))
    report = run_pipeline(size=size)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()