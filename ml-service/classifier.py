"""TF-IDF + Logistic Regression classifiers for ticket category and priority."""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from training_data import EXAMPLES


def _build_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, stop_words="english")),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
        ]
    )


class TicketClassifier:
    def __init__(self) -> None:
        texts = [t for t, _, _ in EXAMPLES]
        categories = [c for _, c, _ in EXAMPLES]
        priorities = [p for _, _, p in EXAMPLES]

        self.category_pipeline = _build_pipeline()
        self.category_pipeline.fit(texts, categories)

        self.priority_pipeline = _build_pipeline()
        self.priority_pipeline.fit(texts, priorities)

    def predict(self, text: str) -> tuple[str, str, float]:
        category = self.category_pipeline.predict([text])[0]
        category_proba = self.category_pipeline.predict_proba([text])[0].max()

        priority = self.priority_pipeline.predict([text])[0]

        # Confidence shown to the admin reflects the category call, since that's
        # the prediction they can override — priority rides along with it.
        confidence = float(category_proba)
        return category, priority, confidence


classifier = TicketClassifier()
