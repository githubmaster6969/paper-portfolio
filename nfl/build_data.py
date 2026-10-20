#!/usr/bin/env python3
"""Read-only: converts Sports Trader's picks_log.csv into data.json for the dashboard.
Voided picks and R14 shadow picks (unstaked prop unders: stake 0 / "[shadow" in reason, Pedro 2026-10-20) are excluded,
so they never count in record, units or ROI. Shadow picks are still tracked in the sports-brain repo (Brier / hit rate)."""
import csv, json, sys, datetime, pathlib
SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent / "data" / "picks_log.csv")
OUT = pathlib.Path(__file__).with_name("data.json")
NUM = {"week","odds_american","implied_prob","model_prob","edge","confidence","stake_units","closing_odds","clv","profit_units","dk_odds","fd_odds"}
KEEP = ["week","date","game","kickoff_et","bet_type","market","pick","pick_label","odds_american","odds_source","captured_at","implied_prob","model_prob","edge","model_version","confidence","stake_units","reason","reason_plain","result","closing_odds","clv","profit_units"]
def num(v):
    v = (v or "").strip()
    if v == "": return None
    f = float(v); return int(f) if f.is_integer() else f
rows = []
with SRC.open(newline="") as fh:
    for r in csv.DictReader(fh):
        o = {k: (num(r.get(k)) if k in NUM else (r.get(k) or "").strip() or None) for k in KEEP}
        if o["stake_units"] is None: o["stake_units"] = 1  # blank stake = 1u; an explicit 0 means shadow/void
        is_void = (o.get("result") or "").strip().lower() == "void"
        is_shadow = "[shadow" in (o.get("reason") or "").lower() or (o["stake_units"] == 0 and not is_void)
        if not is_void and not is_shadow:
            rows.append(o)
json.dump({"generated_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
           "source": str(SRC.resolve()), "picks": rows}, OUT.open("w"), indent=1)
print(f"wrote {len(rows)} picks (voided + R14 shadow excluded) -> {OUT}")
