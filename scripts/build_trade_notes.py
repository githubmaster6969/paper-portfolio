#!/usr/bin/env python3
"""Keep data/trade_notes.json and data/buy_notes.json in step with the trade data.

Merge-only: never overwrites a field that already has text, so hand-written plain-English notes survive.
For every closed paper trade in data/options.json (grouped by entryDate|entryTime|ticker) and every closed
live trade in live/live.json that has no note yet, it adds a skeleton with the numbers filled in from the data
and the plain-English fields templated or left empty ("" = page shows "Not logged" / "Not checked yet").
For every dip buy in data/holdings.json without a buy note it adds an empty {what, why_this} entry.
Chart PNGs named like <paper|real>-YYYY-MM-DD-TICKER-*.png in --charts are copied into assets/trades/.

After-close routine (run from the repo root):
    python3 scripts/build_trade_notes.py            # add skeletons for new trades/buys
    python3 scripts/build_trade_notes.py --check    # list notes that still need plain-English text
Then fill the listed fields from the logs (options-study/paper-options-log.csv, setups/, MISTAKES.md) and
Webull/TradingView news for the trade day, and commit data/trade_notes.json data/buy_notes.json (+ any new
assets/trades/*.png) with explicit paths. Never invent a reason: leave a field empty if the log has none, and
mark any link added after the trade in why_check.
"""
import argparse, csv, glob, json, os, shutil, sys
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
PLAIN_FIELDS = ['why_type', 'plain_why', 'plain_plan', 'plain_outcome', 'plain_happened', 'plain_lesson']


def load(path, default=None):
    try:
        with open(path) as f:
            return json.load(f, object_pairs_hook=OrderedDict)
    except FileNotFoundError:
        return default


def save(path, data):
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, path)


def money(x):
    return ('−$' if x < 0 else '$') + f'{abs(x):,.2f}'


def csv_reasons(path):
    out = {}
    if not path or not os.path.exists(path):
        return out
    with open(path) as f:
        for r in csv.DictReader(f):
            out.setdefault((r.get('date'), r.get('time'), r.get('ticker')), []).append(r.get('reason') or '')
    return out


def find_chart(prefix, date, ticker, charts_dir):
    pat = f'{prefix}-{date}-{ticker}-*.png'
    have = sorted(glob.glob(P('assets', 'trades', pat)))
    if not have and charts_dir:
        src = sorted(glob.glob(os.path.join(charts_dir, pat)))
        if src:
            dst = P('assets', 'trades', os.path.basename(src[0]))
            shutil.copy2(src[0], dst)
            have = [dst]
    return 'assets/trades/' + os.path.basename(have[0]) if have else None


def skeleton(title, entry_at, entry_px, exit_px, premium, qty, pnl, chart, log, source):
    pct = (pnl / premium * 100) if premium else 0
    word = 'Profit' if pnl > 0 else 'Loss' if pnl < 0 else 'Result'
    sign = '+' if pnl > 0 else ''
    return OrderedDict([
        ('title', title), ('setup', ''), ('setupDetail', ''), ('rules', ''),
        ('why', ''), ('expected', ''), ('happened', ''), ('playedOut', ''),
        ('right', []), ('wrong', []), ('lesson', ''), ('grade', ''), ('tags', []),
        ('entryAt', entry_at), ('exitAt', ''), ('entryPrice', entry_px), ('exitPrice', exit_px), ('premium', premium),
        ('chart', chart), ('log', log), ('source', source),
        ('why_type', ''), ('plain_why', ''), ('plain_plan', ''),
        ('plain_outcome', f'{"Closed for a gain" if pnl > 0 else "Closed for a loss" if pnl < 0 else "Closed flat"}: {sign}{money(pnl)} ({sign}{pct:.0f}%).'.replace('(-', '(−')),
        ('plain_happened', f'Bought {qty} contract{"s" if qty != 1 else ""} at ${entry_px:,.2f} and sold at ${exit_px:,.2f}. {word}: {sign}{money(pnl)}.'),
        ('plain_right', []), ('plain_wrong', []), ('plain_lesson', ''),
        ('why_moved', OrderedDict([('summary', ''), ('sources', [])])),
        ('charts', OrderedDict([('before', None), ('during', chart), ('after', None)])),
        ('needs_review', True),
    ])


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--check', action='store_true', help='only list notes missing plain-English text')
    ap.add_argument('--log', default='/workspace/options-study/paper-options-log.csv')
    ap.add_argument('--live-log', default='/workspace/options-study/live-account/log.csv')
    ap.add_argument('--charts', default='/workspace/charts/out')
    a = ap.parse_args()

    notes = load(P('data', 'trade_notes.json'), OrderedDict([('_about', ''), ('trades', OrderedDict())]))
    T = notes.setdefault('trades', OrderedDict())
    bn = load(P('data', 'buy_notes.json'), OrderedDict([('_about', ''), ('buys', OrderedDict())]))
    B = bn.setdefault('buys', OrderedDict())

    if a.check:
        gaps = 0
        for k, n in T.items():
            miss = [f for f in PLAIN_FIELDS if not n.get(f)]
            if not (n.get('why_moved') or {}).get('summary'):
                miss.append('why_moved')
            if n.get('needs_review'):
                miss.append('needs_review')
            if miss:
                gaps += 1
                print(f'trade {k}: {", ".join(miss)}')
        for k, n in B.items():
            miss = [f for f in ('what', 'why_this') if not n.get(f)]
            if miss:
                gaps += 1
                print(f'buy {k}: {", ".join(miss)}')
        print(f'{gaps} note(s) need plain-English text' if gaps else 'all notes have plain-English text')
        return

    added = []
    reasons = csv_reasons(a.log)
    opt = load(P('data', 'options.json'), {}) or {}
    groups = OrderedDict()
    for r in opt.get('closed', []):
        groups.setdefault(f"{r['entryDate']}|{r['entryTime']}|{r['ticker']}", []).append(r)
    for k, rows in groups.items():
        key = 'paper|' + k
        if key in T:
            continue
        d, t, tk = k.split('|')
        qty = sum(r['qty'] for r in rows)
        contracts = list(OrderedDict.fromkeys(r['contract'] for r in rows))
        premium = round(sum(r['entry'] * r['qty'] * 100 for r in rows), 2)
        pnl = round(sum(r.get('realized') or 0 for r in rows), 2)
        if len(contracts) > 1:   # multi-leg (straddle): per-unit price = sum of legs
            n = rows[0]['qty']; e = round(sum(r['entry'] for r in rows), 4); x = round(sum(r['exit'] for r in rows), 4)
        else:
            n = qty; e = round(premium / qty / 100, 4); x = round(sum(r['exit'] * r['qty'] for r in rows) / qty, 4)
        log = ' | '.join(reasons.get((d, t, tk), []))
        T[key] = skeleton(' + '.join(contracts) + f' x{n} ({int(d[5:7])}/{int(d[8:])})', f'{d}T{t}', e, x, premium, n, pnl,
                          find_chart('paper', d, tk, a.charts), log, 'data/options.json closed rows' + ('; paper-options-log.csv' if log else ''))
        added.append(key)

    live = load(P('live', 'live.json'), {}) or {}
    lreasons = csv_reasons(a.live_log)
    for r in live.get('trades', []):
        if r.get('status') != 'closed':
            continue
        key = f"live|{r['date']}|{r['time']}|{r['contract']}"
        if key in T:
            continue
        tk = r['contract'].split()[0]
        q = r.get('qty') or 1
        log = ' | '.join(lreasons.get((r['date'], r['time'], tk), []))
        T[key] = skeleton(r['contract'] + f' x{q:g}', f"{r['date']}T{r['time']}", r['entry'], r['exit'], round(r['entry'] * q * 100, 2), int(q),
                          r.get('pnl') or 0, find_chart('real', r['date'], tk, a.charts), log, 'live/live.json')
        added.append(key)

    # existing notes: add any missing new-schema fields without touching text that is there
    for k, n in T.items():
        n.setdefault('why_moved', OrderedDict([('summary', ''), ('sources', [])]))
        n.setdefault('charts', OrderedDict([('before', None), ('during', n.get('chart')), ('after', None)]))
        for f in ('plain_right', 'plain_wrong'):
            n.setdefault(f, [])
        for f in PLAIN_FIELDS:
            n.setdefault(f, '')

    hj = load(P('data', 'holdings.json'), {}) or {}
    for b in hj.get('buys', []):
        k = f"{b['date']}|{b.get('time_et', '')}|{b['ticker']}"
        if k not in B:
            B[k] = OrderedDict([('what', ''), ('why_this', '')])
            added.append('buy ' + k)

    save(P('data', 'trade_notes.json'), notes)
    save(P('data', 'buy_notes.json'), bn)
    print('added: ' + ', '.join(added) if added else 'no new trades or buys')


if __name__ == '__main__':
    main()
