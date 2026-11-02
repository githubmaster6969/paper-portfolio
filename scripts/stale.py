"""Per-symbol stale-data check for Webull get_stock_snapshot results (trading-brain config.md v2.0 B; Pedro t173u 2026-11-02).
A symbol is STALE if: no price; or its last_trade_time is not on the session date; or, during regular hours,
its quote_time is more than MAX_AGE_S older than the reference time (the newest quote in the file unless `now` is given).
Each symbol is judged on its own (the old scripts used max(quote_time) across all symbols, which hid stale names).
Stale symbols must be flagged and excluded, never silently priced."""
import datetime as dt
from zoneinfo import ZoneInfo
ET = ZoneInfo("America/New_York")
MAX_AGE_S = 120


def _et(ms):
    return dt.datetime.fromtimestamp(int(ms) / 1000, ET)


def check(quotes, now=None, session_date=None, max_age_s=MAX_AGE_S):
    """quotes: {symbol: snapshot dict} or list. Returns {symbol: {"ok": bool, "reasons": [...], "last_trade_et": str, "quote_et": str}}."""
    qs = quotes if isinstance(quotes, dict) else {x["symbol"]: x for x in quotes}
    qts = [_et(x["quote_time"]) for x in qs.values() if x.get("quote_time")]
    ref = now or (max(qts) if qts else None)
    day = session_date or (ref.date() if ref else None)
    rth = ref is not None and ref.weekday() < 5 and dt.time(9, 30) <= ref.time() <= dt.time(16, 0)
    out = {}
    for s, x in qs.items():
        r = []
        lt = _et(x["last_trade_time"]) if x.get("last_trade_time") else None
        qt = _et(x["quote_time"]) if x.get("quote_time") else None
        if not x.get("price"):
            r.append("no price")
        if lt is None:
            r.append("no last_trade_time")
        elif day and lt.date() != day:
            r.append(f"last trade {lt:%Y-%m-%d %H:%M} ET is not today's session {day}")
        if rth and qt is not None and (ref - qt).total_seconds() > max_age_s:
            r.append(f"quote {int((ref - qt).total_seconds())}s old at {ref:%H:%M:%S} ET (max {max_age_s}s)")
        out[s] = {"ok": not r, "reasons": r, "last_trade_et": f"{lt:%Y-%m-%d %H:%M:%S}" if lt else None,
                  "quote_et": f"{qt:%Y-%m-%d %H:%M:%S}" if qt else None}
    return out
