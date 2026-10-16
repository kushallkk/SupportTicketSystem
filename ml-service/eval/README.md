# How the classifier is evaluated

Two small, hand-written test sets that the model is **never trained on**:

| File | Tickets | Role |
|---|---|---|
| `benchmark.json` | 100 (20 per category) | The yardstick used while building and for the promotion gate. I looked at it while choosing the approach, so treat it as a *development* set: its scores are somewhat optimistic. |
| `holdout.json` | 50 (10 per category) | Written *before* the final experiments and scored **once**, after the configuration was frozen. This is the number to trust. |

Both are small (a 95% margin of error is roughly ±9 points on 100 tickets and ±11 on 50), so only large
differences mean anything. They are also written by one person; they measure "does it handle plausible,
varied phrasing", not "how will it do on your real customers".

## Results (category accuracy / macro-F1; priority accuracy)

| | Benchmark (100) | Sealed hold-out (50) |
|---|---|---|
| Original model (TF-IDF, 54 examples) | 64% / 0.64; priority 63% | 66% / 0.65; priority 60% |
| Embeddings + same 54 examples (current) | **91% / 0.91**; priority 70% | **82% / 0.81**; priority 60% |

Priority accuracy did not improve on the hold-out (macro-F1 0.55 -> 0.62).

## What was tried and rejected

A public dataset was evaluated (`Tobi-Bueck/customer-support-tickets`, CC BY-NC 4.0, **synthetic**). Its
queue labels don't match ours and are noisy, so rows were kept only where queue and wording agree
(`public_data.py`). Even so, adding it **lowered** category accuracy from 91% to between 69% and 89%
depending on weighting, and its priority labels dropped priority accuracy from 70% to 50%. It is not used
by default. `python train.py --public` exists to reproduce the experiment.

Data: Tobi-Bueck/customer-support-tickets on Hugging Face, CC BY-NC 4.0 (attribution, non-commercial).

## Retraining

```bash
python train.py                  # compare original vs current vs candidate on the benchmark; saves nothing
python train.py --db --save      # also learn from admin corrections in the DB, and save if it isn't worse
python train.py --holdout        # also score the sealed hold-out (do this rarely, or it stops being sealed)
```

Or press **Retrain from corrections** on the admin Analytics page (needs `ML_ADMIN_TOKEN`).

The only labels fully trusted from the app are **admin corrections**: tickets where an admin changed the AI's
category or priority. Resolved tickets are not used as labels, because the model assigned those categories in
the first place, so training on them would just teach it to agree with itself.

A new model replaces the current one only if its benchmark macro-F1 is within 0.03 (category) / 0.05
(priority) of the current model's. Training refuses any example identical to a benchmark/hold-out ticket.
