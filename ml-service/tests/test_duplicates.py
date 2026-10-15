import numpy as np
import pytest

import duplicates


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.queries = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.queries.append((sql, params))

    def fetchall(self):
        return self.rows


class FakeConn:
    def __init__(self, rows):
        self.cursor_obj = FakeCursor(rows)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self):
        return self.cursor_obj


def unit(*values):
    v = np.array(values, dtype=np.float32)
    return (v / np.linalg.norm(v)).tolist()


@pytest.fixture
def fake_db(monkeypatch):
    holder = {}

    def install(rows):
        conn = FakeConn(rows)
        holder["conn"] = conn
        monkeypatch.setattr(duplicates, "get_connection", lambda: conn)
        return conn

    return install


def test_empty_embedding_short_circuits_without_db(monkeypatch):
    def boom():
        raise AssertionError("DB must not be touched for an empty embedding")

    monkeypatch.setattr(duplicates, "get_connection", boom)
    assert duplicates.find_similar([], None) == []


def test_results_sorted_best_first_with_expected_similarity(fake_db):
    fake_db([
        ("far", unit(0, 1, 0)),
        ("near", unit(1, 0.1, 0)),
        ("same", unit(1, 0, 0)),
    ])
    matches = duplicates.find_similar(unit(1, 0, 0), None)
    assert [m["ticketId"] for m in matches] == ["same", "near", "far"]
    assert matches[0]["similarity"] == pytest.approx(1.0, abs=1e-4)
    assert matches[2]["similarity"] == pytest.approx(0.0, abs=1e-4)


def test_limit_is_respected(fake_db):
    fake_db([(f"t{i}", unit(1, i, 0)) for i in range(10)])
    assert len(duplicates.find_similar(unit(1, 0, 0), None, limit=3)) == 3


def test_skips_rows_with_mismatched_dimensions_or_empty_embeddings(fake_db):
    fake_db([("bad-dim", unit(1, 0)), ("empty", []), ("ok", unit(1, 0, 0))])
    matches = duplicates.find_similar(unit(1, 0, 0), None)
    assert [m["ticketId"] for m in matches] == ["ok"]


def test_exclude_id_is_passed_to_the_query(fake_db):
    conn = fake_db([])
    duplicates.find_similar(unit(1, 0, 0), "ticket-123")
    sql, params = conn.cursor_obj.queries[0]
    assert params == ("ticket-123",)
    assert "id !=" in sql


def test_only_resolved_or_closed_tickets_are_candidates(fake_db):
    conn = fake_db([])
    duplicates.find_similar(unit(1, 0, 0), None)
    sql, _ = conn.cursor_obj.queries[0]
    assert "RESOLVED" in sql and "CLOSED" in sql
