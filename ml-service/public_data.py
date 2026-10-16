"""
Loads a public support-ticket dataset and maps it onto ResolveIQ's labels.

Source: Tobi-Bueck/customer-support-tickets on Hugging Face (English rows of the 20k file).
  - License: CC BY-NC 4.0 (attribution, NON-COMMERCIAL use only). Fine for this academic project.
  - It is SYNTHETIC (LLM-generated). No openly licensed dataset of real customer tickets exists,
    so this adds phrasing variety and volume, not ground truth from real customers.

Its labels do not line up with ours: there is no account or feature-request queue, and the queue
field is noisy (a "Billing and Payments" ticket can be about securing medical data). So a row is
kept only when its queue AND its wording agree on exactly one of our categories. Everything that is
ambiguous is dropped instead of guessed.
"""

import csv
import re
from dataclasses import dataclass
from pathlib import Path

REPO = "Tobi-Bueck/customer-support-tickets"
FILENAME = "dataset-tickets-multi-lang-4-20k.csv"
CACHE_DIR = Path(__file__).parent / ".cache"
ATTRIBUTION = (
    "Tobi-Bueck/customer-support-tickets (Hugging Face), CC BY-NC 4.0, synthetic data; "
    "used here for non-commercial research."
)

BILLING_QUEUES = {"Billing and Payments"}
TECH_QUEUES = {"Technical Support", "IT Support", "Service Outages and Maintenance"}
OTHER_QUEUES = {"Customer Service", "General Inquiry", "Human Resources", "Sales and Pre-Sales", "Returns and Exchanges"}

_re = lambda p: re.compile(p, re.IGNORECASE)
BILLING_WORDS = _re(r"\b(refund|invoice|charged|billing|payment|subscription|receipt|credit card|overcharg|price|pricing)")
TECH_WORDS = _re(
    r"\b(error|crash|bug|fail|not working|stopped working|outage|down|slow|time[- ]?out|unresponsive|"
    r"freez|glitch|malfunction|disconnect|performance issue)"
)
ACCOUNT_WORDS = _re(
    r"\b(password|log[- ]?in|locked out|two[- ]factor|2fa|sign[- ]?in|username|account (access|recovery|locked|suspended)|"
    r"verification (code|email)|reset (my|your) password)"
)
FEATURE_WORDS = _re(
    r"(feature request|would like to see|please add|could you add|new feature|enhancement request|wish (you|it)|"
    r"would be (great|nice|helpful) (if|to have))"
)

MAX_CHARS = 500  # production tickets are "title. description"; keep training text the same scale


@dataclass(frozen=True)
class Example:
    text: str
    category: str | None
    priority: str | None
    source: str


def download() -> Path:
    from huggingface_hub import hf_hub_download

    CACHE_DIR.mkdir(exist_ok=True)
    return Path(hf_hub_download(REPO, FILENAME, repo_type="dataset", local_dir=CACHE_DIR / "tobi-bueck"))


def classify_row(queue: str, ticket_type: str, text: str) -> str | None:
    """Our category for a row, or None if queue and wording don't agree on exactly one."""
    hits: set[str] = set()
    if queue in BILLING_QUEUES and BILLING_WORDS.search(text):
        hits.add("billing")
    if queue in TECH_QUEUES and TECH_WORDS.search(text):
        hits.add("technical")
    if ACCOUNT_WORDS.search(text):
        hits.add("account")
    if FEATURE_WORDS.search(text) and ticket_type in ("Request", "Change"):
        hits.add("feature_request")
    if queue in OTHER_QUEUES and not (
        BILLING_WORDS.search(text) or TECH_WORDS.search(text) or ACCOUNT_WORDS.search(text) or FEATURE_WORDS.search(text)
    ):
        hits.add("other")
    # Account wording alongside billing/tech wording is genuinely ambiguous: drop rather than guess.
    if "account" in hits and (BILLING_WORDS.search(text) or (queue in BILLING_QUEUES)):
        return None
    return next(iter(hits)) if len(hits) == 1 else None


def load(max_per_class: int = 800, seed: int = 0, path: Path | None = None) -> list[Example]:
    import random

    path = path or download()
    csv.field_size_limit(10**8)
    by_class: dict[str, list[Example]] = {}
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.DictReader(f):
            if row["language"] != "en":
                continue
            text = f"{row['subject'].strip()}. {row['body'].strip()}"[:MAX_CHARS].strip()
            if len(text) < 20:
                continue
            category = classify_row(row["queue"], row["type"], text)
            if category is None:
                continue
            by_class.setdefault(category, []).append(
                Example(text, category, row["priority"].upper(), "public:tobi-bueck")
            )

    rng = random.Random(seed)
    out: list[Example] = []
    for category, items in sorted(by_class.items()):
        rng.shuffle(items)
        out.extend(items[:max_per_class])  # cap so one class can't dominate
    return out
