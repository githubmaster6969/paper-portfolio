#!/usr/bin/env python3
"""Rebuild data/options.json from trading-brain CSVs + a saved quotes JSON.
Usage: options_update.py [--brain /workspace/options-study] [--quotes data/options_quotes.json]
Paper contracts only. optStop = rules v1.3 #5 -50% option backstop (was -35% pre-2026-10-19). Marks come from the quotes file (Robinhood); nothing is invented."""
import csv, json, argparse, os
p = argparse.ArgumentParser()
p.add_argument('--brain', default='/workspace/options-study')
p.add_argument('--quotes', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'options_quotes.json'))
p.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'data', 'options.json'))
a = p.parse_args()
BUDGET = 5000.0
q = json.load(open(a.quotes))
rows = list(csv.DictReader(open(os.path.join(a.brain, 'paper-options-log.csv'))))
ledger = list(csv.DictReader(open(os.path.join(a.brain, 'options-ledger.csv'))))
cash = float(ledger[-1]['cash_balance']) if ledger else BUDGET
opn, closed = [], []
for r in rows:
    if r['status'] == 'planned-bell' or not r['entry_mark']:
        continue
    qty, entry = int(r['qty']), float(r['entry_mark'])
    cost = entry * 100 * qty
    base = dict(contract=r['contract'], ticker=r['ticker'], type=r['type'], strike=float(r['strike']),
                expiry=r['expiry'], qty=qty, entry=entry, entryDate=r['date'], entryTime=r['time'])
    if r['status'] == 'open':
        mark = q['marks'].get(r['instrument_id'])
        lv = q.get('levels', {}).get(r['contract'], {})
        base.update(mark=mark, underlying=q.get('underlying', {}).get(r['ticker']),
                    value=round(mark * 100 * qty, 2) if mark is not None else None,
                    unrealized=round((mark - entry) * 100 * qty, 2) if mark is not None else None,
                    unrealizedPct=round((mark / entry - 1) * 100, 2) if mark is not None else None,
                    optStop=round(entry * 0.50, 3), optHalf=round(entry * 1.5, 2), optDouble=round(entry * 2, 2),
                    stockTarget=lv.get('stockTarget'), stockStop=lv.get('stockStop'), stopNote=lv.get('stopNote'))
        opn.append(base)
    else:
        ex = float(r['exit_mark']) if r['exit_mark'] else None
        base.update(exit=ex, status=r['status'],
                    realized=round((ex - entry) * 100 * qty, 2) if ex is not None else (float(r['pnl']) if r['pnl'] else None))
        closed.append(base)
unreal = sum(x['unrealized'] or 0 for x in opn)
real = sum(x['realized'] or 0 for x in closed)
mv = sum(x['value'] or 0 for x in opn)
out = dict(budget=BUDGET, cash=round(cash, 2), openValue=round(mv, 2), equity=round(cash + mv, 2),
           unrealized=round(unreal, 2), realized=round(real, 2), totalPnl=round(unreal + real, 2),
           totalPct=round((unreal + real) / BUDGET * 100, 2), open=opn, closed=closed,
           asOf=q['asOf'], source=q.get('source'))
json.dump(out, open(a.out, 'w'), indent=1)
print(json.dumps({k: out[k] for k in ('cash', 'equity', 'totalPnl', 'asOf')}))
