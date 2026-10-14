#!/usr/bin/env python3
"""Log a PAPER buy funded from cash (never a real order). Price must come from a saved Webull snapshot file.
Usage: python3 scripts/add_buy.py SNAPSHOT_FILE TICKER AMOUNT --reason "..." [--portfolio S|D|A] [--rule R2]
Refuses if: ticker missing from snapshot, amount > cash, or buy would leave cash below the reserve in stock-buy-rules.md."""
import json, sys, argparse, datetime as dt, pathlib
from zoneinfo import ZoneInfo
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from ledger import as_of
R = pathlib.Path(__file__).resolve().parent.parent; P = R / "data/holdings.json"
NAMES = {"S": "Safe Core", "D": "Diversifier", "A": "Aggressive AI & Energy"}
ap = argparse.ArgumentParser(); ap.add_argument("snapshot"); ap.add_argument("ticker"); ap.add_argument("amount", type=float)
ap.add_argument("--reason", required=True); ap.add_argument("--portfolio"); ap.add_argument("--rule", default=""); ap.add_argument("--reserve", type=float, default=1000.0)
a = ap.parse_args(); t = open(a.snapshot).read()
q = {x["symbol"]: x for x in json.loads(t[t.index("["):t.rindex("]") + 1])}
if a.ticker not in q or not q[a.ticker].get("price"): sys.exit(f"ABORT: no Webull price for {a.ticker}")
price = float(q[a.ticker]["price"]); et = dt.datetime.fromtimestamp(int(q[a.ticker]["quote_time"]) / 1000, ZoneInfo("America/New_York"))
day = et.strftime("%Y-%m-%d"); cfg = json.load(open(P)); L = as_of(cfg, day)
if a.amount > L["cash"] - a.reserve: sys.exit(f"ABORT: cash {L['cash']} minus reserve {a.reserve} < {a.amount}")
h = next((h for h in cfg["holdings"] if h["ticker"] == a.ticker), None)
if not h:
    if not a.portfolio: sys.exit("ABORT: new ticker needs --portfolio S|D|A (and must be on the approved watchlist)")
    cfg["holdings"].append(h := {"ticker": a.ticker, "portfolio": NAMES[a.portfolio], "shares": 0.0, "cost_basis": 0.0, "buy_price": price, "date": day})
b = {"date": day, "time_et": et.strftime("%H:%M"), "ticker": a.ticker, "portfolio": h["portfolio"], "shares": round(a.amount / price, 6),
     "price": price, "amount": round(a.amount, 2), "rule": a.rule, "reason": a.reason, "source": f"Webull snapshot last trade {et:%Y-%m-%d %H:%M} ET"}
cfg.setdefault("buys", []).append(b); json.dump(cfg, open(P, "w"), indent=1)
print(json.dumps({**b, "cash_after": round(L["cash"] - a.amount, 2)}))
