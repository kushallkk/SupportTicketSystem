"""Rules-based agent load-balancing score — not ML, just a weighted formula.

score = 0.45 * workload_score + 0.25 * speed_score + 0.30 * category_accuracy

- workload_score rewards agents with fewer open tickets right now.
- speed_score rewards agents who historically resolve this category faster.
- category_accuracy is the agent's track record for this category.
"""

WORKLOAD_WEIGHT = 0.45
SPEED_WEIGHT = 0.25
ACCURACY_WEIGHT = 0.30


def score_agent(open_count: int, avg_resolution_mins: float, accuracy_score: float) -> dict:
    workload_score = 1 / (1 + open_count)
    speed_score = 1 / (1 + max(avg_resolution_mins, 0) / 60)
    accuracy = max(0.0, min(1.0, accuracy_score))

    total = WORKLOAD_WEIGHT * workload_score + SPEED_WEIGHT * speed_score + ACCURACY_WEIGHT * accuracy

    return {
        "workload": round(workload_score, 4),
        "categoryAccuracy": round(accuracy, 4),
        "avgResolutionMins": round(avg_resolution_mins, 1),
        "total": round(total, 4),
    }


def pick_best_agent(agents: list[dict]) -> tuple[str | None, float | None, dict | None]:
    if not agents:
        return None, None, None

    best = None
    best_breakdown = None
    best_total = -1.0

    for agent in agents:
        breakdown = score_agent(agent["openCount"], agent["avgResolutionMins"], agent["accuracyScore"])
        if breakdown["total"] > best_total:
            best_total = breakdown["total"]
            best = agent["id"]
            best_breakdown = breakdown

    return best, best_total, best_breakdown
