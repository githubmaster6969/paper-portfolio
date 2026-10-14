#!/usr/bin/env python3
"""Intraday refresh of data/portfolio.json from a saved Webull get_stock_snapshot result.
Usage: python3 scripts/intraday_update.py SNAPSHOT_FILE [--session open|midday|close] [--log /workspace/paper-portfolio-log.csv]
SNAPSHOT_FILE: JSON array (or text containing it) of Webull snapshots for all holdings + SPY.
Replaces today's point if it exists. Aborts if any symbol is missing (never estimates prices)."""
import json, sys, argparse, datetime as dt, pathlib
from zoneinfo import ZoneInfo
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from ledger import as_of
R = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("snapshot"); ap.add_argument("--session"); ap.add_argument("--log")
a = ap.parse_args()
t = open(a.snapshot).read()
q = {x["symbol"]: x for x in json.loads(t[t.index("["):t.rindex("]") + 1])}
P = R / "data/portfolio.json"; d = json.load(open(P))
need = [h["t"] for h in d["holdings"]] + ["SPY"]
miss = [s for s in need if s not in q or not q[s].get("price")]
if miss: sys.exit(f"ABORT: missing Webull prices for {miss}")
qt = dt.datetime.fromtimestamp(max(int(q[s]["quote_time"]) for s in need) / 1000, dt.timezone.utc)
et = qt.astimezone(ZoneInfo("America/New_York")); day = et.strftime("%Y-%m-%d")
if d["dates"][-1] != day:
    d["dates"].append(day)
    for k in d["series"]: d["series"][k].append(0)
    for k in d["history"]: d["history"][k].append(None)
cfg = json.load(open(R / "data/holdings.json")); L = as_of(cfg, day)
for k in ("C", "CONTRIB"):
    d["series"].setdefault(k, [None] * (len(d["dates"]) - 1) + [0])
    d["series"][k] = [x if x is not None else as_of(cfg, dd)[{"C": "cash", "CONTRIB": "contrib"}[k]] for x, dd in zip(d["series"][k], d["dates"])]
v = {"S": 0.0, "D": 0.0, "A": 0.0}
for h in d["holdings"]:
    p = float(q[h["t"]]["price"]); h["price"] = p; h["sh"] = round(L["sh"][h["t"]], 6); h["buy"] = round(L["cost"][h["t"]] / h["sh"], 4)
    h["prev"] = float(q[h["t"]]["pre_close"])
    d["history"][h["t"]][-1] = p; v[h["p"]] += h["sh"] * p
for k in "SDA": d["series"][k][-1] = round(v[k], 2)
d["series"]["T"][-1] = T = round(sum(v.values()) + L["cash"], 2)
d["series"]["C"][-1] = L["cash"]; d["series"]["CONTRIB"][-1] = CON = L["contrib"]
d["cash"] = L["cash"]; d["contrib"] = CON; d["ledger"] = cfg.get("cash_ledger", []); d["buys"] = cfg.get("buys", []); d["spy"]["sh"] = round(L["spy_sh"], 6)
d["spy"]["price"] = float(q["SPY"]["price"]); d["spy"]["prev"] = float(q["SPY"]["pre_close"])
d["series"]["SPY"][-1] = SPYV = round(d["spy"]["sh"] * d["spy"]["price"], 2)
d["asOf"] = qt.isoformat(timespec="seconds"); d["intraday"] = True
d["source"] = f"Intraday: Webull live snapshot (last trade) for {day}; prior days: daily closes via yfinance. Start prices: Webull closes {d['start']}."
json.dump(d, open(P, "w"), indent=1)
if a.log and a.session:
    row = [et.strftime("%Y-%m-%d %H:%M"), a.session] + [f"{v[k]:.2f}" for k in "SDA"] + [f"{T:.2f}", f"{T-CON:.2f}", f"{SPYV:.2f}",
           ";".join(f"{s}={float(q[s]['price']):g}" for s in need), f"{L['cash']:.2f}", f"{CON:.2f}", f"{SPYV-CON:.2f}"]
    open(a.log, "a").write(",".join(row) + "\n")
mv = sorted(((float(q[s]["price"]) / float(q[s]["pre_close"]) - 1) * 100, s) for s in need[:-1])
print(json.dumps({"asOf": d["asOf"], "et": et.strftime("%H:%M"), "S": round(v["S"], 2), "D": round(v["D"], 2), "A": round(v["A"], 2),
                  "total": T, "cash": L["cash"], "contrib": CON, "pl": round(T - CON, 2), "spy": SPYV, "spy_pl": round(SPYV - CON, 2), "top": mv[-3:][::-1], "bottom": mv[:3]}))
