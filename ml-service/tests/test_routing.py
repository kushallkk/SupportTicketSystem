import pytest

from routing import pick_best_agent, score_agent


def agent(id, open_count=0, mins=60.0, acc=0.5):
    return {"id": id, "openCount": open_count, "avgResolutionMins": mins, "accuracyScore": acc}


def test_no_agents_returns_none():
    assert pick_best_agent([]) == (None, None, None)


def test_single_agent_is_chosen():
    agent_id, score, breakdown = pick_best_agent([agent("a1")])
    assert agent_id == "a1"
    assert score == breakdown["total"]


def test_least_loaded_agent_wins_when_other_factors_equal():
    agents = [agent("busy", open_count=9), agent("free", open_count=0)]
    assert pick_best_agent(agents)[0] == "free"


def test_faster_agent_wins_when_other_factors_equal():
    agents = [agent("slow", mins=600), agent("fast", mins=30)]
    assert pick_best_agent(agents)[0] == "fast"


def test_more_accurate_agent_wins_when_other_factors_equal():
    agents = [agent("meh", acc=0.4), agent("great", acc=0.95)]
    assert pick_best_agent(agents)[0] == "great"


def test_workload_outweighs_speed_and_accuracy():
    # A free-but-slower agent should beat a swamped-but-fast, accurate one.
    swamped = agent("swamped", open_count=15, mins=20, acc=0.95)
    free = agent("free", open_count=0, mins=300, acc=0.6)
    assert pick_best_agent([swamped, free])[0] == "free"


def test_score_components_are_bounded():
    b = score_agent(open_count=0, avg_resolution_mins=0, accuracy_score=1.0)
    assert b["workload"] == 1.0
    assert b["categoryAccuracy"] == 1.0
    assert b["total"] == pytest.approx(0.45 + 0.25 + 0.30)


def test_out_of_range_accuracy_is_clamped():
    assert score_agent(0, 60, 5.0)["categoryAccuracy"] == 1.0
    assert score_agent(0, 60, -2.0)["categoryAccuracy"] == 0.0


def test_negative_resolution_time_does_not_inflate_score():
    assert score_agent(0, -500, 0.5)["total"] == score_agent(0, 0, 0.5)["total"]


def test_score_is_monotonic_in_open_count():
    totals = [score_agent(n, 60, 0.5)["total"] for n in range(0, 12)]
    assert totals == sorted(totals, reverse=True)
