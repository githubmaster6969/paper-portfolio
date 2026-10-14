#!/usr/bin/env python3
"""Compute hypothetical portfolio values since 2026-10-09 from Yahoo Finance daily closes (yfinance).
Start prices = Webull closes 2026-10-09 (holdings.json). Idempotent: rewrites data/portfolio.json."""
import json, datetime as dt, pathlib
import pandas as pd, yfinance as yf, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from ledger import as_of
R = pathlib.Path(__file__).resolve().parent.parent
cfg = json.load(open(R/"data/holdings.json")); H = cfg["holdings"]; B = cfg["benchmark"]
START = "2026-10-09"; code = {"Safe Core": "S", "Diversifier": "D", "Aggressive AI & Energy": "A"}
syms = sorted({h["ticker"] for h in H} | {"SPY"})
df = yf.download(syms, start=START, interval="1d", progress=False, auto_adjust=False)["Close"]
df.index = [d.strftime("%Y-%m-%d") for d in df.index]
df = df[df.index >= START]
failed = [s for s in syms if s not in df or df[s].dropna().empty]
buy = {h["ticker"]: h["buy_price"] for h in H}; buy["SPY"] = B["buy_price"]
last = dict(buy); prev = dict(buy); dates = sorted(set(df.index) | {START}); series = {k: [] for k in ["S", "D", "A", "T", "SPY", "C", "CONTRIB"]}
holding_tickers = [h["ticker"] for h in H]; history = {t: [] for t in holding_tickers}
for d in dates:
    if d != START:
        for s in syms:
            if s in df and d in df.index and pd.notna(df.at[d, s]):
                prev[s] = last.get(s, buy[s])
                last[s] = float(df.at[d, s])
    L = as_of(cfg, d); v = {"S": 0.0, "D": 0.0, "A": 0.0}
    for h in H: v[code[h["portfolio"]]] += L["sh"][h["ticker"]] * last[h["ticker"]]
    for k in "SDA": series[k].append(round(v[k], 2))
    series["T"].append(round(sum(v.values()) + L["cash"], 2)); series["SPY"].append(round(L["spy_sh"] * last["SPY"], 2))
    series["C"].append(L["cash"]); series["CONTRIB"].append(L["contrib"])
    for t in holding_tickers:
        if d == START: history[t].append(buy[t])
        elif t in df and d in df.index and pd.notna(df.at[d, t]): history[t].append(float(df.at[d, t]))
        else: history[t].append(None)
L = as_of(cfg, dates[-1])
out = {"start": START, "asOf": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "lastClose": dates[-1],
       "dates": dates, "series": series, "history": history,
       "holdings": [{"t": h["ticker"], "p": code[h["portfolio"]], "sh": round(L["sh"][h["ticker"]], 6), "buy": round(L["cost"][h["ticker"]] / L["sh"][h["ticker"]], 4), "price": last[h["ticker"]], "prev": prev[h["ticker"]]} for h in H],
       "cash": L["cash"], "contrib": L["contrib"], "ledger": cfg.get("cash_ledger", []), "buys": cfg.get("buys", []),
       "spy": {"sh": round(L["spy_sh"], 6), "buy": B["buy_price"], "price": last["SPY"], "prev": prev["SPY"]}, "failed": failed,
       "source": "Daily closes from Yahoo Finance via yfinance. Start prices: Webull closes 2026-10-09."}
json.dump(out, open(R/"data/portfolio.json", "w"), indent=1)
print(dates[-1], "total", series["T"][-1], "contrib", L["contrib"], "pl", round(series["T"][-1] - L["contrib"], 2), "SPY", series["SPY"][-1], "failed", failed)
