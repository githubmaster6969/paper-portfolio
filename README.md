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
