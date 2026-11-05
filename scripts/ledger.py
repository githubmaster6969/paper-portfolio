"""Shared cash / contributions / buys logic. Source of truth: data/holdings.json
  cash_ledger: [{date, type:"deposit", amount, spy_price, spy_shares, spy_price_source}]
  buys:        [{date, time_et, ticker, portfolio, shares, price, amount, reason, source}]
Base holdings (shares/buy_price) are the 2026-10-09 lots and never change; buys add lots.
Benchmark SPY gets every deposit on the same date at a logged Webull price.
  splits:      [{date, ticker, ratio}] forward splits; from `date` (the first split-adjusted session) on, every lot
               bought before `date` has shares x ratio. Cost basis is unchanged."""
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
        sh[b["ticker"]] = sh.get(b["ticker"], 0) + b["shares"] * _split_factor(cfg, b["ticker"], b["date"], day)
        cost[b["ticker"]] = cost.get(b["ticker"], 0) + b["amount"]
    for t in sh:
        if t in {h["ticker"] for h in cfg["holdings"]}:
            sh[t] += next(h["shares"] for h in cfg["holdings"] if h["ticker"] == t) * (_split_factor(cfg, t, "2026-10-09", day) - 1)
    return {"contrib": round(contrib, 2), "cash": round(cash, 2), "spy_sh": spy_sh, "sh": sh, "cost": cost}
def _split_factor(cfg, ticker, lot_date, day):
    """Product of split ratios for `ticker` effective after lot_date and on/before day."""
    f = 1.0
    for s in cfg.get("splits", []):
        if s["ticker"] == ticker and lot_date < s["date"] <= day: f *= s["ratio"]
    return f
