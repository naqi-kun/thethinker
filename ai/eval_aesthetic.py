"""Behavioural eval for combination-driven aesthetics (KAN-123).

Aesthetic is emergent from how pieces are *paired*, not a per-item tag. This
harness feeds ONE versatile wardrobe to the live stylist for several aesthetics
and checks that the chosen top+bottom+shoes COMBINATION shifts to match the
requested vibe — e.g. for "Athleisure" the bottom and shoes should be athletic
(joggers/trainers), not denim; the same polo should pair with jeans for
streetwear but chinos for preppy.

This is a LIVE eval: it calls the real recommender, so results are
non-deterministic. Each scenario runs EVAL_RUNS times and we report a pass
rate. Run it on demand (not in CI).

Usage:
    AI_SERVICE_URL=http://localhost:8001 python eval_aesthetic.py
    EVAL_RUNS=5 python eval_aesthetic.py      # more samples per aesthetic

Exit code is non-zero if any scenario passes less than PASS_THRESHOLD of runs.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter

BASE = os.environ.get("AI_SERVICE_URL", "http://localhost:8001").rstrip("/")
RUNS = int(os.environ.get("EVAL_RUNS", "3"))
PASS_THRESHOLD = float(os.environ.get("PASS_THRESHOLD", "0.66"))

# One versatile menswear wardrobe. The same pieces can read as several
# aesthetics depending on how they're combined — that's the whole point.
WARDROBE = [
    # tops
    {"id": "polo", "sub_type": "shirt", "category": "casual", "color": "green", "fit": "regular", "season": "all"},
    {"id": "oxford", "sub_type": "shirt", "category": "formal", "color": "light blue", "fit": "slim", "season": "all"},
    {"id": "tee", "sub_type": "t-shirt", "category": "casual", "color": "white", "fit": "regular", "season": "all"},
    {"id": "graphictee", "sub_type": "t-shirt", "category": "casual", "color": "green", "fit": "regular", "season": "all"},
    {"id": "sweater", "sub_type": "sweater", "category": "casual", "color": "grey", "fit": "relaxed", "season": "all"},
    {"id": "hoodie", "sub_type": "hoodie", "category": "casual", "color": "beige", "fit": "oversized", "season": "all"},
    {"id": "athl-hoodie", "sub_type": "hoodie", "category": "sport", "color": "grey", "fit": "regular", "season": "all"},
    {"id": "blazer", "sub_type": "blazer", "category": "formal", "color": "navy blue", "fit": "regular", "season": "all"},
    # bottoms
    {"id": "jeans", "sub_type": "jeans", "category": "casual", "color": "grey", "fit": "relaxed", "season": "all"},
    {"id": "chinos", "sub_type": "pants", "category": "casual", "color": "beige", "fit": "slim", "season": "all"},
    {"id": "cargo", "sub_type": "pants", "category": "casual", "color": "beige", "fit": "relaxed", "season": "all"},
    {"id": "joggers", "sub_type": "pants", "category": "sport", "color": "white", "fit": "relaxed", "season": "all"},
    {"id": "trousers", "sub_type": "pants", "category": "formal", "color": "navy blue", "fit": "regular", "season": "all"},
    # shoes
    {"id": "sneakers", "sub_type": "sneakers", "category": "casual", "color": "beige", "fit": "regular", "season": "all"},
    {"id": "trainers", "sub_type": "sneakers", "category": "sport", "color": "black", "fit": "regular", "season": "all"},
    {"id": "loafers", "sub_type": "shoes", "category": "formal", "color": "black", "fit": "regular", "season": "all"},
    {"id": "boots", "sub_type": "boots", "category": "casual", "color": "black", "fit": "regular", "season": "all"},
]
BY_ID = {i["id"]: i for i in WARDROBE}


def _denim(item):
    return item["sub_type"] == "jeans"


def _sport(item):
    return item["category"] == "sport"


# Each predicate takes the chosen (top, bottom, shoes) and returns (ok, why).
def check_athleisure(top, bottom, shoes):
    # The defining signal is an athletic bottom (joggers); sneakers/trainers complete it.
    ok = _sport(bottom) and shoes["sub_type"] == "sneakers"
    return ok, "athletic bottom (joggers) + sneakers/trainers"


def check_streetwear(top, bottom, shoes):
    # Relaxed casual bottom (jeans/cargo) + sneakers. Athletic sneakers are fine here —
    # the point is it's NOT tailored/formal and the bottom isn't slim chinos or trousers.
    ok = (
        bottom["category"] == "casual"
        and bottom["fit"] in ("relaxed", "oversized")
        and shoes["sub_type"] == "sneakers"
    )
    return ok, "relaxed casual bottom (jeans/cargo) + sneakers"


def check_preppy(top, bottom, shoes):
    ok = not _denim(bottom) and not _sport(bottom) and not _sport(shoes)
    return ok, "tailored bottom (chinos/trousers, not denim/sweats), no sporty shoes"


def check_old_money(top, bottom, shoes):
    ok = bottom["category"] == "formal" and shoes["category"] == "formal"
    return ok, "tailored formal trousers + refined shoes (loafers)"


SCENARIOS = [
    ("Athleisure", check_athleisure),
    ("Streetwear", check_streetwear),
    ("Preppy", check_preppy),
    ("Old Money", check_old_money),
]


def request_outfit(aesthetic):
    payload = json.dumps({"wardrobe_items": WARDROBE, "aesthetic": aesthetic}).encode()
    req = urllib.request.Request(
        f"{BASE}/recommend/start",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        rec = json.load(resp)["recommendation"]
    return rec


def main():
    print(f"AI service: {BASE}   runs/aesthetic: {RUNS}\n")
    overall_ok = True
    # Track the bottom each aesthetic favours, to show the pairing actually shifts.
    bottoms_by_aesthetic = {}

    for aesthetic, check in SCENARIOS:
        passes = 0
        bottoms = Counter()
        print(f"== {aesthetic} ==")
        for n in range(RUNS):
            try:
                rec = request_outfit(aesthetic)
            except (urllib.error.URLError, KeyError, TimeoutError) as exc:
                print(f"  run {n + 1}: ERROR {exc}")
                continue
            top, bottom, shoes = (BY_ID.get(rec["top_id"]), BY_ID.get(rec["bottom_id"]), BY_ID.get(rec["shoes_id"]))
            if not (top and bottom and shoes):
                print(f"  run {n + 1}: returned unknown id(s) {rec}")
                continue
            ok, why = check(top, bottom, shoes)
            passes += ok
            bottoms[bottom["id"]] += 1
            mark = "PASS" if ok else "FAIL"
            print(f"  run {n + 1}: [{mark}] {top['id']} + {bottom['id']} + {shoes['id']}")
            print(f"           why: {rec.get('reasoning', '')}")
        rate = passes / RUNS if RUNS else 0
        bottoms_by_aesthetic[aesthetic] = bottoms
        status = "OK" if rate >= PASS_THRESHOLD else "BELOW THRESHOLD"
        if rate < PASS_THRESHOLD:
            overall_ok = False
        print(f"  -> {passes}/{RUNS} pass ({rate:.0%})  [{status}]  expected: {check.__doc__ or why}\n")

    # The headline demonstration: the same wardrobe pairs differently per vibe.
    sw = bottoms_by_aesthetic.get("Streetwear", Counter()).most_common(1)
    pp = bottoms_by_aesthetic.get("Preppy", Counter()).most_common(1)
    if sw and pp:
        print(f"Pairing shift — Streetwear favoured '{sw[0][0]}', Preppy favoured '{pp[0][0]}' "
              f"({'DIFFERENT (good)' if sw[0][0] != pp[0][0] else 'SAME (no shift)'})")

    print("\nRESULT:", "PASS" if overall_ok else "FAIL")
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()
