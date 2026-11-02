# Paper Portfolio
Hypothetical $10k paper portfolio tracker (not real money, not advice). Data updated weekdays by GitHub Actions.

## Plain-English notes (round 2)

- `data/trade_notes.json`: each trade has beginner-level fields the site shows (`plain_why`, `plain_plan`, `plain_outcome`, `plain_happened`, `plain_right`, `plain_wrong`, `plain_lesson`, `why_type`, `why_check`, `why_moved`, `charts.before/during/after`). Raw fields (`why`, `log`, `rules`…) stay in the file for the bot but are never shown.
- `data/buy_notes.json`: plain "what happened" and "why this stock" per dip buy, keyed `date|time_et|ticker`. Kept separate so `scripts/add_buy.py` doesn't change.
- `data/about.json`: what each holding does, plus latest and next earnings for stocks (Webull / TradingView). Refresh after each earnings report; leave a field out rather than guess.
- `data/setups.json`: the "Setups explained" glossary and "Words to know".

### After the close

```
cd /workspace/paper-portfolio && python3 scripts/build_trade_notes.py && python3 scripts/build_trade_notes.py --check
```

The first command adds skeleton notes (numbers, outcome, what happened, charts) for any new closed paper or live trade and empty entries for new dip buys; it never overwrites written text. `--check` lists the fields still empty. Fill them in plain English, then commit `data/trade_notes.json`, `data/buy_notes.json` and any new `assets/trades/*.png` by explicit path.

## Round 3 notes (2026-11-02)

### Real (Robinhood) trades use the same trade sheet
Live trades on `/live/` open the same sheet as paper trades. Their notes live in `data/trade_notes.json` under the key `live|YYYY-MM-DD|HH:MM|<contract>` (date, time and contract exactly as in `live/live.json`), with the same `plain_*`, `why_type` and `charts.before/during/after` fields. `scripts/build_trade_notes.py` already creates skeletons for new closed live trades; the after-close routine fills the text. Empty = the page shows "Not logged".

### Setups shown on the site
"Setups explained" lists only setups with `status: "Active"` in `data/setups.json`. Retired, `"Testing on paper"` and `"n/a"` (Pedro override, Test trade) entries stay in the file but are hidden. "P&L by setup" leaves out `n/a` one-offs and shows them in one line underneath; those trades still appear in the journal.

### Monthly review format (`data/monthly_reviews.json`)
Written for Pedro, a beginner: plain English, short sentences, terms explained in words (e.g. "support (a price floor)"), and only numbers that come from the logs. Each review:

```json
{
  "month": "2026-10", "title": "October 2026", "period": "...", "written": "YYYY-MM-DD", "factCheck": "...",
  "headline": "2–3 sentences: stock value vs money put in vs SPY, options result.",
  "stats": [{"label": "plain label", "value": "$..."}],
  "sections": [{"h": "How the money is spread", "items": ["..."]}, {"h": "How our buys went", "items": []}, {"h": "Options (paper money)", "items": []}],
  "needs_ok": [{"do": "a change to a rule (buy rules or options rulebook)", "why": "one line, with the number behind it"}],
  "auto": [{"do": "something already allowed by the current rules", "why": "one line"}],
  "strategy": "What this means for the strategy: one or two sentences."
}
```

`needs_ok` = anything that changes a rule; nothing happens until Pedro approves. `auto` = things the bots will do anyway within the rules. The month is not shown as a chip; the title says it.

### Charts on phones
Chart values show in a readout row above each chart (no floating tooltip covering the line), with an axis caption under it. Tap or drag to read; a second tap on the same point or tapping elsewhere clears it. On the equity curve one tap on a dot opens that trade. Trade chart images open in a full-screen viewer (pinch or double-tap to zoom, swipe down or × to close). Sheets close with a swipe down.
