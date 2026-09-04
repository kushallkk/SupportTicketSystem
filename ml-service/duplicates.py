"""Cosine-similarity duplicate detection against resolved tickets."""

import numpy as np

from db import get_connection


def find_similar(embedding: list[float], exclude_ticket_id: str | None, limit: int = 5) -> list[dict]:
    if not embedding:
        return []

    query_vec = np.array(embedding, dtype=np.float32)

    with get_connection() as conn, conn.cursor() as cur:
        if exclude_ticket_id:
            cur.execute(
                """
                SELECT id, embedding FROM "Ticket"
                WHERE status IN ('RESOLVED', 'CLOSED') AND cardinality(embedding) > 0 AND id != %s
                """,
                (exclude_ticket_id,),
            )
        else:
            cur.execute(
                """
                SELECT id, embedding FROM "Ticket"
                WHERE status IN ('RESOLVED', 'CLOSED') AND cardinality(embedding) > 0
                """
            )
        rows = cur.fetchall()

    scored: list[tuple[str, float]] = []
    for ticket_id, emb in rows:
        if not emb:
            continue
        candidate = np.array(emb, dtype=np.float32)
        if candidate.shape != query_vec.shape:
            continue
        # Embeddings are already L2-normalized at creation time, so dot product == cosine similarity.
        similarity = float(np.dot(query_vec, candidate))
        scored.append((ticket_id, similarity))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [{"ticketId": tid, "similarity": round(sim, 4)} for tid, sim in scored[:limit]]
