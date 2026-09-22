#!/usr/bin/env python3
"""
Knowledge processing (Slice 12, §13) — builds RAG-ready chunks.

approved/  → curated, licensed/reviewed markdown content (committed).
processed/ → chunked knowledge.jsonl consumed by the chatbot RAG layer.

No scraping, no private records: only curated content from approved/.
"""

import json
import re
from pathlib import Path

_KNOW = Path(__file__).resolve().parent
APPROVED = _KNOW / "approved"
PROCESSED = _KNOW / "processed"

def md_to_chunks(path: Path, source: str) -> list:
    """Split a markdown file on '## ' headings into RAG chunks."""
    text = path.read_text(encoding="utf-8")
    blocks = re.split(r"(?m)^##\s+", text)
    chunks = []
    for block in blocks:
        if not block.strip():
            continue
        lines = block.splitlines()
        title = (lines[0].strip() if lines else "Untitled")
        body = "\n".join(lines[1:]).strip()
        if not body:
            continue
        body = re.sub(r"\s+", " ", body)
        chunks.append({
            "id": f"{source}::{title.lower().replace(' ', '-')}",
            "source": source,
            "title": title,
            "body": body,
            "tokens_approx": len(body.split()),
        })
    return chunks


def build() -> int:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    total_chunks = 0
    for md in sorted(APPROVED.glob("*.md")):
        chunks = md_to_chunks(md, source=md.stem)
        out = PROCESSED / f"{md.stem}.jsonl"
        with out.open("w", encoding="utf-8") as fh:
            for c in chunks:
                fh.write(json.dumps(c, ensure_ascii=False, sort_keys=True) + "\n")
        total_chunks += len(chunks)
        print(f"[knowledge] {md.name}: {len(chunks)} chunks → {out}")
    return total_chunks


if __name__ == "__main__":
    print(f"[knowledge] total chunks: {build()}")