#!/usr/bin/env python3
"""Log a PAPER cash deposit; the SPY benchmark buys the same dollars at the real Webull SPY price in SNAPSHOT_FILE.
Usage: python3 scripts/add_deposit.py SNAPSHOT_FILE AMOUNT [--note "Weekly $800"]   (idempotent per date+amount)"""
import json, sys, argparse, datetime as dt, pathlib
from zoneinfo import ZoneInfo
R = pathlib.Path(__file__).resolve().parent.parent; P = R / "data/holdings.json"
ap = argparse.ArgumentParser(); ap.add_argument("snapshot"); ap.add_argument("amount", type=float); ap.add_argument("--note", default="Weekly Friday deposit")
a = ap.parse_args(); t = open(a.snapshot).read()
q = {x["symbol"]: x for x in json.loads(t[t.index("["):t.rindex("]") + 1])}
if "SPY" not in q or not q["SPY"].get("price"): sys.exit("ABORT: no Webull SPY price")
px = float(q["SPY"]["price"]); et = dt.datetime.fromtimestamp(int(q["SPY"]["quote_time"]) / 1000, ZoneInfo("America/New_York")); day = et.strftime("%Y-%m-%d")
cfg = json.load(open(P)); led = cfg.setdefault("cash_ledger", [])
if any(x["date"] == day and x["amount"] == a.amount for x in led): sys.exit(f"SKIP: deposit {a.amount} already logged for {day}")
led.append({"date": day, "type": "deposit", "amount": a.amount, "note": a.note, "spy_price": px, "spy_shares": round(a.amount / px, 6),
            "spy_price_source": f"Webull snapshot last trade {et:%Y-%m-%d %H:%M} ET"})
json.dump(cfg, open(P, "w"), indent=1); print(json.dumps(led[-1]))
