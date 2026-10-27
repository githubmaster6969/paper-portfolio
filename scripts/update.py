#!/usr/bin/env python3
"""Nightly rebuild of data/portfolio.json (GitHub Action, after the close).
Price per date, in priority order:
  1. the logged 4 PM close: the committed Webull close snapshot data/snapshots/close-YYYY-MM-DD[-HHMM].json
     written by the 4 PM close update (latest file for the day; must contain every holding + SPY);
  2. otherwise the Yahoo Finance daily close (yfinance).
Never carries a prior close forward: if a date has no logged close and yfinance has no close for any
held symbol or SPY, the script exits non-zero WITHOUT writing (the Action fails loudly).
Start prices = Webull closes 2026-10-09 (holdings.json). Idempotent: rewrites data/portfolio.json."""
import json, datetime as dt, pathlib, re, sys
from zoneinfo import ZoneInfo
import pandas as pd, yfinance as yf
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from ledger import as_of
R = pathlib.Path(__file__).resolve().parent.parent
cfg = json.load(open(R/"data/holdings.json")); H = cfg["holdings"]; B = cfg["benchmark"]
START = "2026-10-09"; code = {"Safe Core": "S", "Diversifier": "D", "Aggressive AI & Energy": "A"}
syms = sorted({h["ticker"] for h in H} | {"SPY"})
def die(msg): print(f"::error::{msg}"); sys.exit(f"ABORT (portfolio.json not written): {msg}")

def logged_closes():
    """{date: {symbol: price}} from committed 4 PM close snapshots; latest file per date wins."""
    out = {}
    for f in sorted((R/"data/snapshots").glob("close-*.json")):
        m = re.match(r"close-(\d{4}-\d{2}-\d{2})", f.name)
        if not m: continue
        t = f.read_text(); arr = json.loads(t[t.index("["):t.rindex("]") + 1])
        q = {x["symbol"]: float(x["price"]) for x in arr if x.get("price")}
        qt = max(int(x["quote_time"]) for x in arr)
        day = dt.datetime.fromtimestamp(qt / 1000, ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
        if day != m.group(1): die(f"{f.name}: quote_time date {day} != file date")
        out[day] = q
    return out

LC = {d: q for d, q in logged_closes().items() if d >= START}
df = yf.download(syms, start=START, interval="1d", progress=False, auto_adjust=False)["Close"]
df.index = [d.strftime("%Y-%m-%d") for d in df.index]
df = df[df.index >= START]
failed = [s for s in syms if s not in df or df[s].dropna().empty]

def yclose(d, s):
    return float(df.at[d, s]) if s in df and d in df.index and pd.notna(df.at[d, s]) else None

buy = {h["ticker"]: h["buy_price"] for h in H}; buy["SPY"] = B["buy_price"]
dates = sorted(set(df.index) | set(LC) | {START})
px = {}; src = {}
for d in dates:
    if d == START: px[d] = dict(buy); src[d] = "start"; continue
    L = as_of(cfg, d); need = [s for s in syms if s == "SPY" or L["sh"].get(s, 0) > 0]
    if d in LC:
        miss = [s for s in need if s not in LC[d]]
        if miss: die(f"logged close snapshot for {d} is missing {miss}")
        px[d] = {s: LC[d][s] for s in syms if s in LC[d]}; src[d] = "logged close"
    else:
        px[d] = {s: c for s in syms if (c := yclose(d, s)) is not None}
        miss = [s for s in need if s not in px[d]]
        if miss: die(f"no close for {d} for {miss}: yfinance returned no price and there is no logged close "
                     f"snapshot (data/snapshots/close-{d}*.json). Not carrying the prior close forward.")
        src[d] = "yfinance"

last = dict(buy); prev = dict(buy); series = {k: [] for k in ["S", "D", "A", "T", "SPY", "C", "CONTRIB"]}
holding_tickers = [h["ticker"] for h in H]; history = {t: [] for t in holding_tickers}
for d in dates:
    for s, p in px[d].items():
        if d != START: prev[s] = last.get(s, buy[s])
        last[s] = p
    L = as_of(cfg, d); v = {"S": 0.0, "D": 0.0, "A": 0.0}
    for h in H: v[code[h["portfolio"]]] += L["sh"][h["ticker"]] * last[h["ticker"]]
    for k in "SDA": series[k].append(round(v[k], 2))
    series["T"].append(round(sum(v.values()) + L["cash"], 2)); series["SPY"].append(round(L["spy_sh"] * last["SPY"], 2))
    series["C"].append(L["cash"]); series["CONTRIB"].append(L["contrib"])
    for t in holding_tickers: history[t].append(px[d].get(t))
L = as_of(cfg, dates[-1])
out = {"start": START, "asOf": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "lastClose": dates[-1],
       "dates": dates, "series": series, "history": history,
       "holdings": [{"t": h["ticker"], "p": code[h["portfolio"]], "sh": round(L["sh"][h["ticker"]], 6), "buy": round(L["cost"][h["ticker"]] / L["sh"][h["ticker"]], 4), "price": last[h["ticker"]], "prev": prev[h["ticker"]]} for h in H],
       "cash": L["cash"], "contrib": L["contrib"], "ledger": cfg.get("cash_ledger", []), "buys": cfg.get("buys", []),
       "spy": {"sh": round(L["spy_sh"], 6), "buy": B["buy_price"], "price": last["SPY"], "prev": prev["SPY"]}, "failed": failed,
       "priceSource": src,
       "source": "Daily closes: logged 4 PM Webull close snapshots where present, else Yahoo Finance via yfinance. Start prices: Webull closes 2026-10-09."}
json.dump(out, open(R/"data/portfolio.json", "w"), indent=1)
print(dates[-1], "total", series["T"][-1], "contrib", L["contrib"], "pl", round(series["T"][-1] - L["contrib"], 2), "SPY", series["SPY"][-1],
      "logged-close days", sum(v == "logged close" for v in src.values()), "failed", failed)
