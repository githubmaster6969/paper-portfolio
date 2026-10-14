"""Shared cash / contributions / buys logic. Source of truth: data/holdings.json
  cash_ledger: [{date, type:"deposit", amount, spy_price, spy_shares, spy_price_source}]
  buys:        [{date, time_et, ticker, portfolio, shares, price, amount, reason, source}]
Base holdings (shares/buy_price) are the 2026-10-09 lots and never change; buys add lots.
Benchmark SPY gets every deposit on the same date at a logged Webull price."""
BASE = 10000.0
def as_of(cfg, day):
    dep = [x for x in cfg.get("cash_ledger", []) if x["date"] <= day]
    buys = [b for b in cfg.get("buys", []) if b["date"] <= day]
    contrib = BASE + sum(x["amount"] for x in dep)
    cash = sum(x["amount"] for x in dep) - sum(b["amount"] for b in buys)
    spy_sh = cfg["benchmark"]["shares"] + sum(x["spy_shares"] for x in dep)
    sh = {h["ticker"]: h["shares"] for h in cfg["holdings"]}
    cost = {h["ticker"]: h["cost_basis"] for h in cfg["holdings"]}
    for b in buys:
        sh[b["ticker"]] = sh.get(b["ticker"], 0) + b["shares"]; cost[b["ticker"]] = cost.get(b["ticker"], 0) + b["amount"]
    return {"contrib": round(contrib, 2), "cash": round(cash, 2), "spy_sh": spy_sh, "sh": sh, "cost": cost}
