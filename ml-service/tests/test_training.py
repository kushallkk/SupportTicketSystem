import json

import joblib
import numpy as np
import pytest
from fastapi.testclient import TestClient

import classifier as serving
import db_data
import evaluate
import main
import model_store
import training
from db_data import Correction
from training_data import CATEGORIES, PRIORITIES

client = TestClient(main.app)


def run(**kwargs):
    kwargs.setdefault("embed", training._default_embed)
    return training.run(**kwargs)


class TestServingModelQuality:
    """Regression floors well below the measured numbers (91% dev / 82% sealed hold-out)."""

    def test_beats_the_old_tfidf_baseline_by_a_wide_margin(self):
        current = serving.classifier._get()
        scored = evaluate.evaluate_items(
            evaluate.load_benchmark(), training._predict_batch(current, training._default_embed), CATEGORIES, PRIORITIES
        )
        baseline = evaluate.evaluate_items(
            evaluate.load_benchmark(), training.TfidfBaseline().predict_batch, CATEGORIES, PRIORITIES
        )
        assert scored["category"]["accuracy"] >= 0.80
        assert scored["category"]["accuracy"] >= baseline["category"]["accuracy"] + 0.10
        assert all(m["recall"] >= 0.6 for m in scored["category"]["per_class"].values()), "no class may collapse"

    def test_confidence_is_informative(self):
        # The old model's confidence barely differed between right and wrong answers.
        current = serving.classifier._get()
        scored = evaluate.evaluate_items(
            evaluate.load_benchmark(), training._predict_batch(current, training._default_embed), CATEGORIES, PRIORITIES
        )
        conf = scored["category"]["confidence"]
        assert conf["mean_when_correct"] > conf["mean_when_wrong"] + 0.10


class TestLearningFromCorrections:
    def test_admin_corrections_change_what_the_model_predicts(self):
        jargon = [
            "The ZorbFlux connector keeps dropping and our Quillmaster jobs are stuck",
            "Quillmaster queue frozen again, ZorbFlux sync reports a timeout",
            "ZorbFlux node unreachable so Quillmaster can't start",
            "Quillmaster stuck behind a broken ZorbFlux link, nothing is processing",
            "ZorbFlux timeouts are blocking every Quillmaster run today",
        ]
        corrections = [Correction(t, "technical", None) for t in jargon]
        probe = "Our Quillmaster pipeline is stalled because ZorbFlux is unreachable"

        report = run(corrections=corrections)

        assert report["promoted"], report["reason"]
        vector = np.array(training._default_embed([probe]))
        assert training.predict_vectors(report["_candidate"], vector)[0][0] == "technical"
        assert report["sources"] == {"builtin": 54, "admin-corrections": 5}

    def test_a_priority_only_correction_does_not_touch_the_category_model(self):
        report = run(corrections=[Correction("Printer on floor 2 jams sometimes", None, "LOW")])
        assert report["sources"]["admin-corrections"] == 1
        assert len(report["_candidate"]["category_model"].classes_) == len(CATEGORIES)

    def test_corrections_are_weighted_above_seed_examples(self):
        assert db_data.CORRECTION_WEIGHT > 1.0


class TestPromotionGate:
    def test_a_harmful_candidate_is_rejected_and_nothing_is_saved(self, tmp_path):
        # 40 corrections claiming billing tickets are "technical": a model trained on them gets worse.
        bad = [
            Correction(t, "technical", None)
            for t in [
                "I was charged twice for my subscription", "Refund my last invoice please", "Payment declined at checkout",
                "My invoice total is wrong", "Update my credit card on file", "Why did my bill go up this month",
                "I need a receipt for my payment", "Coupon code not applying to my order",
            ]
            * 5
        ]
        report = run(corrections=bad, save=True)

        assert report["promoted"] is False
        assert report["saved"] is False
        assert "regressed" in report["reason"]
        assert not model_store.artifact_path().exists()

    def test_a_good_candidate_is_saved_and_the_service_picks_it_up(self):
        good = [Correction("The widget exporter crashes with a stack trace on startup", "technical", None)]
        report = run(corrections=good, save=True)

        assert report["promoted"] and report["saved"]
        assert model_store.artifact_path().exists()
        saved_metrics = json.loads(model_store.metrics_path().read_text(encoding="utf-8"))
        assert saved_metrics["sources"]["admin-corrections"] == 1
        assert saved_metrics["benchmark"]["candidate"]["category"]["accuracy"] >= 0.8

        serving.classifier.reload()
        assert serving.classifier.info()["source"] == "trained"
        assert serving.classifier.predict("I was charged twice this month")[0] == "billing"

    def test_without_save_nothing_is_written(self):
        run(corrections=[Correction("Some new technical issue text here", "technical", None)], save=False)
        assert not model_store.artifact_path().exists()

    def test_training_on_benchmark_tickets_is_refused(self):
        leaked = evaluate.benchmark_text(evaluate.load_benchmark()[0])
        with pytest.raises(ValueError, match="identical to benchmark"):
            run(corrections=[Correction(leaked, "billing", None)])

    def test_the_holdout_is_also_protected_from_leakage(self):
        leaked = evaluate.benchmark_text(evaluate.load_holdout()[0])
        with pytest.raises(ValueError, match="identical to benchmark"):
            run(corrections=[Correction(leaked, "billing", None)])

    def test_concurrent_training_runs_are_refused(self):
        assert training._run_lock.acquire(blocking=False)
        try:
            with pytest.raises(training.TrainingBusy):
                run(corrections=[])
        finally:
            training._run_lock.release()


class TestBenchmarkIntegrity:
    def test_sets_are_balanced_and_disjoint_from_training_and_each_other(self):
        bench, hold = evaluate.load_benchmark(), evaluate.load_holdout()
        norm = lambda i: " ".join(evaluate.benchmark_text(i).lower().split())
        for items in (bench, hold):
            counts = {c: sum(i["category"] == c for i in items) for c in CATEGORIES}
            assert len(set(counts.values())) == 1, counts
            assert {i["priority"] for i in items} <= set(PRIORITIES)
        training_texts = {" ".join(t.lower().split()) for t, _, _ in training.EXAMPLES}
        assert not ({norm(i) for i in bench} & {norm(i) for i in hold})
        assert not ({norm(i) for i in bench + hold} & training_texts)


class TestModelStore:
    def test_round_trip_and_no_temp_files_left_behind(self):
        artifact = training.train_builtin(training._default_embed)
        model_store.save(artifact, {"ok": True})
        loaded = model_store.load()
        assert loaded is not None and loaded["trained_at"] == artifact["trained_at"]
        assert sorted(p.name for p in model_store.model_dir().iterdir()) == ["classifier.joblib", "metrics.json"]

    def test_incompatible_or_corrupt_files_are_ignored_not_crashed_on(self):
        artifact = training.train_builtin(training._default_embed)
        model_store.model_dir().mkdir(parents=True)

        joblib.dump({**artifact, "sklearn_version": "0.0.1"}, model_store.artifact_path())
        assert model_store.load() is None

        joblib.dump({**artifact, "embedding_model": "some-other-model"}, model_store.artifact_path())
        assert model_store.load() is None

        model_store.artifact_path().write_bytes(b"this is not a pickle")
        assert model_store.load() is None

    def test_missing_file_means_use_builtin(self):
        assert model_store.load() is None
        assert serving.classifier.info()["source"] == "built-in"


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.sql = sql

    def fetchall(self):
        return self.rows


class FakeConn(FakeCursor):
    def cursor(self):
        return FakeCursor(self.rows)


class TestDatabaseCorrections:
    def test_only_changed_fields_become_labels_and_unknown_values_are_dropped(self, monkeypatch):
        rows = [
            # title, description, final category slug, ai category, final priority, ai priority
            ("Card declined", "can't pay", "billing", "technical", "HIGH", "HIGH"),    # category fixed
            ("Slow page", "takes ages", "technical", "technical", "LOW", "HIGH"),      # priority fixed
            ("Both", "changed", "account", "other", "CRITICAL", "LOW"),                # both fixed
            ("Weird", "category", "made_up_slug", "other", "LOW", "LOW"),              # unknown category: dropped
        ]
        monkeypatch.setattr(db_data, "get_connection", lambda: FakeConn(rows))

        got = db_data.load_corrections(CATEGORIES, PRIORITIES)

        assert [(c.text, c.category, c.priority) for c in got] == [
            ("Card declined. can't pay", "billing", None),
            ("Slow page. takes ages", None, "LOW"),
            ("Both. changed", "account", "CRITICAL"),
        ]
        assert all(c.weight == db_data.CORRECTION_WEIGHT for c in got)

    def test_query_looks_only_at_tickets_where_a_human_disagreed_with_the_ai(self, monkeypatch):
        seen = {}
        conn = FakeConn([])
        monkeypatch.setattr(db_data, "get_connection", lambda: conn)
        monkeypatch.setattr(FakeCursor, "execute", lambda self, sql, params=None: seen.setdefault("sql", sql))
        db_data.load_corrections(CATEGORIES, PRIORITIES)
        assert '<> t."aiCategory"' in seen["sql"] and '<> t."aiPriority"' in seen["sql"]


class TestEndpoints:
    def test_model_info(self):
        body = client.get("/model").json()
        assert body["source"] == "built-in"
        assert body["sources"] == {"builtin": 54}

    def test_retrain_is_disabled_without_a_configured_token(self, monkeypatch):
        monkeypatch.delenv("ML_ADMIN_TOKEN", raising=False)
        assert client.post("/retrain", headers={"x-admin-token": "anything"}).status_code == 503

    @pytest.mark.parametrize("headers", [{}, {"x-admin-token": "wrong"}, {"x-admin-token": ""}])
    def test_retrain_rejects_missing_or_wrong_tokens(self, monkeypatch, headers):
        monkeypatch.setenv("ML_ADMIN_TOKEN", "s3cret")
        assert client.post("/retrain", headers=headers).status_code == 403

    def test_retrain_with_the_right_token_trains_and_reloads(self, monkeypatch):
        monkeypatch.setenv("ML_ADMIN_TOKEN", "s3cret")
        monkeypatch.setattr(db_data, "load_corrections", lambda cats, pris: [
            Correction("The reporting widget crashes when exporting", "technical", None)
        ])
        res = client.post("/retrain", headers={"x-admin-token": "s3cret"})
        assert res.status_code == 200
        body = res.json()
        assert body["promoted"] and body["saved"]
        assert body["sources"]["admin-corrections"] == 1
        assert body["benchmark"]["candidate"]["category"]["accuracy"] >= 0.8
        assert client.get("/model").json()["source"] == "trained"

    def test_retrain_while_busy_returns_409(self, monkeypatch):
        monkeypatch.setenv("ML_ADMIN_TOKEN", "s3cret")
        assert training._run_lock.acquire(blocking=False)
        try:
            assert client.post("/retrain", headers={"x-admin-token": "s3cret"}).status_code == 409
        finally:
            training._run_lock.release()
