"""
Retrain the ticket classifier from the command line.

    python train.py                   evaluate only: baseline vs current vs candidate on the benchmark
    python train.py --save            ...and save the candidate if it isn't worse than the current model
    python train.py --db              also learn from admin corrections in the database (needs DATABASE_URL)
    python train.py --holdout         also score the sealed hold-out set (use sparingly; see eval/README.md)
    python train.py --public          EXPERIMENTAL: also add the public dataset (measured to HURT; see below)
"""

import argparse
import json
import sys
import warnings

warnings.filterwarnings("ignore")

import classifier as serving
import model_store
import public_data
import training


def fmt(r: dict) -> str:
    return f"category acc={r['category']['accuracy']:.0%} F1={r['category']['macro_f1']:.2f} | priority acc={r['priority']['accuracy']:.0%} F1={r['priority']['macro_f1']:.2f}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--save", action="store_true", help="save the candidate if it passes the promotion gate")
    ap.add_argument("--db", action="store_true", help="include admin corrections from the database")
    ap.add_argument("--holdout", action="store_true", help="also score the sealed hold-out set")
    ap.add_argument("--public", action="store_true", help="add the public dataset (experimental; lowers accuracy)")
    ap.add_argument("--max-per-class", type=int, default=300, help="cap per class for --public")
    ap.add_argument("--json", action="store_true", help="print the full report as JSON")
    args = ap.parse_args()

    public_examples = None
    if args.public:
        print("NOTE: --public is experimental. On the benchmark it LOWERED category accuracy (91% -> 69-89%).")
        print(f"      Data: {public_data.ATTRIBUTION}\n")
        public_examples = public_data.load(max_per_class=args.max_per_class)

    current = serving.classifier._get()
    report = training.run(
        use_db=args.db, public_examples=public_examples, save=args.save,
        include_holdout=args.holdout, current_artifact=current,
    )
    report.pop("_candidate", None)

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    b = report["benchmark"]
    print(f"Training sources: {report['sources']}")
    print(f"\nBenchmark ({b['candidate']['category']['n']} independent hand-written tickets; +/-9 points is noise):")
    print(f"  old TF-IDF baseline : {fmt(b['baseline_tfidf'])}")
    print(f"  current model       : {fmt(b['current'])}")
    print(f"  candidate           : {fmt(b['candidate'])}")
    conf = b["candidate"]["category"]["confidence"]
    print(f"  candidate confidence: right={conf['mean_when_correct']} wrong={conf['mean_when_wrong']}")
    if "holdout" in report:
        h = report["holdout"]
        print(f"\nHold-out ({h['candidate']['category']['n']} sealed tickets):")
        print(f"  old TF-IDF baseline : {fmt(h['baseline_tfidf'])}")
        print(f"  candidate           : {fmt(h['candidate'])}")
    print(f"\n{'PROMOTED' if report['promoted'] else 'NOT PROMOTED'}: {report['reason']}")
    if args.save:
        print(f"Saved to {model_store.artifact_path()}" if report["saved"] else "Nothing saved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
