"""
Training examples learned from the app itself: tickets where an admin overrode the AI.

A correction is the one label we can fully trust: the model said X, a human looked and said Y.
We deliberately do NOT use "all resolved tickets" as labels by default: every ticket's category
was set by the model in the first place, so training on them just teaches the model to agree
with itself (and the demo seed data would be a pure echo).
"""

from dataclasses import dataclass

from db import get_connection

CORRECTION_WEIGHT = 3.0  # a rare, human-verified label outweighs a hand-written seed example


@dataclass(frozen=True)
class Correction:
    text: str
    category: str | None  # set only when the admin changed the category
    priority: str | None  # set only when the admin changed the priority
    weight: float = CORRECTION_WEIGHT


_QUERY = """
SELECT t.title, t.description, c.slug, t."aiCategory", t.priority::text, t."aiPriority"
FROM "Ticket" t
LEFT JOIN "Category" c ON c.id = t."categoryId"
WHERE (t."aiCategory" IS NOT NULL AND c.slug IS NOT NULL AND c.slug <> t."aiCategory")
   OR (t."aiPriority" IS NOT NULL AND t.priority::text <> t."aiPriority")
ORDER BY t."createdAt"
"""


def load_corrections(known_categories: list[str], known_priorities: list[str]) -> list[Correction]:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(_QUERY)
        rows = cur.fetchall()

    out: list[Correction] = []
    for title, description, slug, ai_category, priority, ai_priority in rows:
        category = slug if ai_category and slug and slug != ai_category and slug in known_categories else None
        final_priority = priority if ai_priority and priority != ai_priority and priority in known_priorities else None
        if category or final_priority:
            out.append(Correction(f"{title}. {description}", category, final_priority))
    return out
