#!/usr/bin/env python3
"""Compute hypothetical portfolio values since 2026-10-09 from Yahoo Finance daily closes (yfinance).
Start prices = Webull closes 2026-10-09 (holdings.json). Idempotent: rewrites data/portfolio.json."""
import json, datetime as dt, pathlib
import pandas as pd, yfinance as yf
R = pathlib.Path(__file__).resolve().parent.parent
cfg = json.load(open(R/"data/holdings.json")); H = cfg["holdings"]; B = cfg["benchmark"]
START = "2026-10-09"; code = {"Safe Core": "S", "Diversifier": "D", "Aggressive AI & Energy": "A"}
syms = sorted({h["ticker"] for h in H} | {"SPY"})
df = yf.download(syms, start=START, interval="1d", progress=False, auto_adjust=False)["Close"]
df.index = [d.strftime("%Y-%m-%d") for d in df.index]
df = df[df.index >= START]
failed = [s for s in syms if s not in df or df[s].dropna().empty]
buy = {h["ticker"]: h["buy_price"] for h in H}; buy["SPY"] = B["buy_price"]
last = dict(buy); dates = sorted(set(df.index) | {START}); series = {k: [] for k in ["S", "D", "A", "T", "SPY"]}
holding_tickers = [h["ticker"] for h in H]; history = {t: [] for t in holding_tickers}
for d in dates:
    if d != START:
        for s in syms:
            if s in df and d in df.index and pd.notna(df.at[d, s]): last[s] = float(df.at[d, s])
    v = {"S": 0.0, "D": 0.0, "A": 0.0}
    for h in H: v[code[h["portfolio"]]] += h["shares"] * last[h["ticker"]]
    for k in "SDA": series[k].append(round(v[k], 2))
    series["T"].append(round(sum(v.values()), 2)); series["SPY"].append(round(B["shares"] * last["SPY"], 2))
    for t in holding_tickers:
        if d == START: history[t].append(buy[t])
        elif t in df and d in df.index and pd.notna(df.at[d, t]): history[t].append(float(df.at[d, t]))
        else: history[t].append(None)
out = {"start": START, "asOf": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "lastClose": dates[-1],
       "dates": dates, "series": series, "history": history,
       "holdings": [{"t": h["ticker"], "p": code[h["portfolio"]], "sh": h["shares"], "buy": h["buy_price"], "price": last[h["ticker"]]} for h in H],
       "spy": {"sh": B["shares"], "buy": B["buy_price"], "price": last["SPY"]}, "failed": failed,
       "source": "Daily closes from Yahoo Finance via yfinance. Start prices: Webull closes 2026-10-09."}
json.dump(out, open(R/"data/portfolio.json", "w"), indent=1)
print(dates[-1], "total", series["T"][-1], "SPY", series["SPY"][-1], "failed", failed)
