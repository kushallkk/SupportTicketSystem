import pytest

from classifier import classifier
from training_data import CATEGORIES, EXAMPLES, PRIORITIES


def test_returns_valid_labels_and_confidence():
    category, priority, confidence = classifier.predict("I was charged twice this month")
    assert category in CATEGORIES
    assert priority in PRIORITIES
    assert 0.0 <= confidence <= 1.0


@pytest.mark.parametrize(
    "text, expected",
    [
        ("I was charged twice for my subscription, please refund the duplicate charge", "billing"),
        ("The app crashes every time I open the settings page", "technical"),
        ("I cannot reset my password, the reset email never arrives", "account"),
        ("It would be great if you added a PDF export for reports", "feature_request"),
    ],
)
def test_obvious_tickets_get_the_expected_category(text, expected):
    assert classifier.predict(text)[0] == expected


def test_outage_language_is_high_or_critical():
    _, priority, _ = classifier.predict("Production is down, nothing is loading, this is critical")
    assert priority in ("HIGH", "CRITICAL")


def test_training_set_is_balanced_enough():
    counts = {c: sum(1 for _, cat, _ in EXAMPLES if cat == c) for c in CATEGORIES}
    assert min(counts.values()) >= 5, counts


def test_fits_its_own_training_data():
    # Sanity floor, not a quality claim: a model that can't fit its own tiny
    # training set is broken (e.g. a bad pipeline change).
    hits = sum(classifier.predict(text)[0] == cat for text, cat, _ in EXAMPLES)
    assert hits / len(EXAMPLES) >= 0.9
