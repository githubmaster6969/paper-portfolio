/* /live page: reads live/live.json (+ ../data/trade_notes.json). */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var U = window.PP, $ = U.$, esc = U.esc, money = U.money, smoney = U.smoney, pct = U.pct, cls = U.cls, r2 = U.r2;
  var GREEN = '#0A9F5A', RED = '#E0383E', L = null, NOTES = {}, chart = null;

  /* "SPY 2026-11-20 790C" -> pieces */
  function parseC(c) {
    var m = /^(\S+)\s+(\d{4}-\d{2}-\d{2})\s+([\d.]+)([CP])$/i.exec(c || '');
    return m ? { tk: m[1], exp: m[2], k: +m[3], type: m[4].toUpperCase() === 'C' ? 'Call' : 'Put' } : null;
  }
  function cName(c) { var p = parseC(c); return p ? p.tk + ' $' + (+p.k).toLocaleString('en-US') + ' ' + p.type : c; }
  function cSub(c) { var p = parseC(c); return p ? 'Expires ' + U.dNum(p.exp) : ''; }
  function tradePct(t) { return t.entry ? (t.exit - t.entry) / t.entry * 100 : null; }

  function render() {
    $('metaLine').innerHTML = '<span>Updated <b>' + esc(U.stamp(L.asOf)) + '</b></span><span>Started with <b>' + money(L.start, 0) + '</b></span><span>Goal <b>' + money(L.goal, 0) + '</b></span>';
    $('val').innerHTML = U.moneyHtml(L.value); $('topVal').textContent = money(L.value);
    $('pnlLine').innerHTML = '<span class="' + cls(L.pnl) + '">' + (L.pnl >= 0 ? '▲ ' : '▼ ') + smoney(L.pnl) + ' (' + pct(L.pnlPct) + ')</span><span class="lbl">all time</span>';
    $('kpis').innerHTML = '<div class="kpi"><dt>Cash</dt><dd>' + money(L.cash) + '</dd></div><div class="kpi"><dt>In open trades</dt><dd>' + money(L.optionsValue) + '</dd></div>' +
      '<div class="kpi"><dt>From closed trades</dt><dd class="' + cls(L.realized) + '">' + smoney(L.realized) + '</dd></div><div class="kpi"><dt>Ready to trade</dt><dd>' + money(L.buyingPower) + '</dd></div>';
    $('source').textContent = 'Real money. Updated ' + U.stamp(L.asOf) + '. Not financial advice.';

    /* value chart */
    var s = (L.series || []).slice().sort(function (a, b) { return new Date(a.t) - new Date(b.t); });
    if (s.length >= 2 && U.chartReady()) {
      var lab = s.map(function (x) { return U.stamp(x.t).replace(/, \d{4},/, ','); }), v = s.map(function (x) { return x.value; });
      var oneDay = lab.every(function (x) { return x.split(',')[0] === lab[0].split(',')[0]; });
      var lineCol = v[v.length - 1] >= L.deposits ? GREEN : RED;
      $('legend').innerHTML = '<span style="--c:' + lineCol + '"><i></i>Account value</span><span style="--c:#C9CDD4"><i class="dash"></i>Deposited ' + money(L.deposits, 0) + '</span>';
      $('valBox').innerHTML = '<canvas role="img" aria-label="Account value over time"></canvas>';
      chart = U.track(new Chart($('valBox').firstChild, { type: 'line', plugins: [U.crosshair],
        data: { labels: lab, datasets: [{ label: 'Value', data: v, borderColor: lineCol, borderWidth: 2.25, pointRadius: 3, pointBackgroundColor: lineCol, tension: .2 },
          { label: 'Deposited', data: v.map(function () { return L.deposits; }), borderColor: '#C9CDD4', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, pointHoverRadius: 0 }] },
        options: (function () { var spread = Math.max.apply(null, v) - Math.min.apply(null, v); var o = U.lineOpts({ yTick: spread < 20 ? function (x) { return '$' + (+x).toFixed(2); } : U.tickMoney, maxX: 4, label: function (c) { return ' ' + c.dataset.label + '  ' + money(c.raw); }, xTick: function (val) { var l = this.getLabelForValue(val); return oneDay ? l.replace(/^[A-Z][a-z]{2} \d{1,2}, /, '').replace(/ ET$/, '') : l.replace(/, \d{1,2}:\d{2} [AP]M ET$/, ''); } }); o.plugins.tooltip.filter = function (it) { return it.datasetIndex === 0; }; return o; })() }));
    } else $('valBox').innerHTML = '<div class="empty"><strong>Chart fills in as snapshots come in</strong>It needs at least two updates.</div>';

    /* goal */
    var prog = Math.max(0, Math.min(100, L.progressPct || 0)), left = Math.max(0, L.goal - L.value);
    $('goalSub').textContent = prog >= 100 ? 'Goal smashed 🎉' : money(left, 0) + ' to go · ' + (prog < 5 ? 'warming up 🔥' : 'keep stacking');
    $('goal').innerHTML = '<div class="goal-nums num"><div class="now">Now<b>' + money(L.value) + '</b></div><div class="tgt">Goal<b>' + money(L.goal, 0) + '</b></div></div>' +
      '<div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + prog + '" aria-label="Progress to goal"><b style="width:' + Math.max(prog, 0.8) + '%"></b></div>' +
      '<div class="goal-sub num"><span>Start ' + money(L.start, 0) + '</span><span><b style="color:var(--ink)">' + prog.toFixed(prog < 10 ? 1 : 0) + '%</b> of the way</span></div>';

    /* simple account tracker */
    var lc = (L.trades || []).filter(function (t) { return t.status === 'closed'; }), lo = (L.trades || []).filter(function (t) { return t.status !== 'closed'; });
    var lw = lc.filter(function (t) { return r2(t.pnl) > 0; }).length, ll = lc.filter(function (t) { return r2(t.pnl) < 0; }).length;
    $('track').innerHTML =
      '<div><dt>Balance now</dt><dd>' + money(L.value) + '</dd></div>' +
      '<div><dt>Money deposited</dt><dd>' + money(L.deposits, 0) + '</dd></div>' +
      '<div><dt>Gain or loss</dt><dd class="' + cls(L.pnl) + '">' + smoney(L.pnl) + '<small>' + pct(L.pnlPct) + '</small></dd></div>' +
      '<div><dt>From closed trades</dt><dd class="' + cls(L.realized) + '">' + smoney(L.realized) + '</dd></div>' +
      '<div><dt>Trades taken</dt><dd>' + (lc.length + lo.length) + '<small>' + (lo.length ? lo.length + ' still open' : 'all closed') + '</small></dd></div>' +
      '<div><dt>Wins / losses</dt><dd>' + lw + ' / ' + ll + (lc.length ? '<small>' + Math.round(lw / lc.length * 100) + '% won</small>' : '') + '</dd></div>';

    /* open */
    var op = L.open || [];
    $('open').innerHTML = op.length ? '<div class="list">' + op.map(function (p, i) {
      return '<button type="button" class="item" data-i="' + i + '"><span class="ava" style="--c:#6D5DF6">' + esc((parseC(p.contract) || { tk: (p.contract || '').split(' ')[0] }).tk.slice(0, 4)) + '</span><span class="main"><span class="t">' + esc(cName(p.contract)) + '</span><span class="s" style="display:block">' + esc(p.expiry ? 'Expires ' + U.dNum(p.expiry) : cSub(p.contract)) + ' · ' + p.qty + '×</span></span>' +
        '<span class="r num"><span class="a" style="display:block">' + money(p.marketValue) + '</span><span class="badge ' + cls(p.unrealized) + '">' + smoney(p.unrealized) + '</span></span><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
    }).join('') + '</div>' : '<div class="empty"><strong>All cash right now 🧘</strong>No open contracts. When one opens, tap it for delta, theta, gamma and vega in plain English.</div>';

    /* history, Robinhood style, grouped by day */
    var tr = (L.trades || []).slice().sort(function (a, b) { return (b.date + b.time) < (a.date + a.time) ? -1 : 1; });
    if (!tr.length) { $('hist').innerHTML = '<div class="empty"><strong>No real trades yet</strong>The first one shows up here.</div>'; }
    else {
      var days = {}, order = [];
      tr.forEach(function (t, i) { t.__i = i; if (!days[t.date]) { days[t.date] = []; order.push(t.date); } days[t.date].push(t); });
      window.__live = tr;
      $('hist').innerHTML = order.map(function (d) {
        return '<div class="eyebrow" style="margin:10px 0 6px">' + esc(U.dLong(d)) + '</div><div class="list">' + days[d].map(function (t) {
          var pp = tradePct(t), res = t.status !== 'closed' ? 'open' : r2(t.pnl) > 0 ? 'win' : r2(t.pnl) < 0 ? 'loss' : 'flat';
          return '<button type="button" class="item" data-h="' + t.__i + '"><span class="ava" style="--c:' + (res === 'win' ? GREEN : res === 'loss' ? RED : '#6D5DF6') + '">' + esc((parseC(t.contract) || { tk: '?' }).tk.slice(0, 4)) + '</span>' +
            '<span class="main"><span class="t">' + esc(cName(t.contract)) + '</span><span class="s" style="display:block">' + esc(U.time12(t.time)) + ' ET · ' + t.qty + ' contract' + (t.qty > 1 ? 's' : '') + ' · bought ' + U.price(t.entry) + (t.exit != null ? ', sold ' + U.price(t.exit) : '') + '</span></span>' +
            '<span class="r num"><span style="display:block;font-size:12px;color:var(--muted);font-weight:500;text-transform:capitalize">' + esc(t.status) + '</span>' +
            (t.status === 'closed' ? '<span class="wl ' + res + '">' + (res === 'win' ? 'Win' : res === 'loss' ? 'Loss' : 'Flat') + ' ' + smoney(t.pnl) + (pp != null ? ' · ' + pct(pp, 1) : '') + '</span>' : '<span class="wl open">Open</span>') + '</span></button>';
        }).join('') + '</div>';
      }).join('');
    }
    $('main').setAttribute('aria-busy', 'false');
  }

  function openTrade(t) {
    var n = NOTES['live|' + t.date + '|' + t.time + '|' + t.contract] || {}, pp = tradePct(t);
    var res = t.status !== 'closed' ? 'open' : r2(t.pnl) > 0 ? 'win' : r2(t.pnl) < 0 ? 'loss' : 'flat';
    var v = PPTrade.render({ contracts: [t.contract], qty: t.qty, res: res, realized: t.pnl, pct: pp, cost: (t.entry || 0) * 100 * t.qty, entryPx: t.entry, exitPx: t.exit,
      entryDate: t.date, entryTime: t.time, fills: [] }, n, '../');
    U.openSheet(v.head, v.body, v.after);
  }
  function openPos(p) {
    var head = '<h3 id="sheetTitle">' + esc(cName(p.contract)) + '</h3><div class="s"><span class="wl open">Open</span> · ' + esc(p.expiry ? 'Expires ' + U.dNum(p.expiry) : cSub(p.contract)) + ' · ' + p.qty + '×</div>';
    var cost = p.avgCost != null ? p.avgCost * p.qty : null;
    var body = '<div class="big num" style="font-size:34px">' + money(p.marketValue) + '</div><div class="delta num"><span class="' + cls(p.unrealized) + '">' + smoney(p.unrealized) + (cost ? ' (' + pct(p.unrealized / cost * 100) + ')' : '') + '</span><span class="lbl">unrealized</span></div>' +
      '<h4 style="margin-top:20px">Position</h4><dl class="kv k3 num"><div><dt>Paid</dt><dd>' + money(cost) + '</dd></div><div><dt>Worth now (per share)</dt><dd>' + U.price(p.mark) + '</dd></div><div><dt>Contracts</dt><dd>' + p.qty + '</dd></div></dl>' +
      '<h4>Risk numbers (Greeks), in plain English</h4>' + window.PPGreeks(p.greeks, p.qty);
    U.openSheet(head, body);
  }
  $('hist').addEventListener('click', function (e) { var b = e.target.closest('[data-h]'); if (b) openTrade(window.__live[+b.dataset.h]); });
  $('open').addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) openPos(L.open[+b.dataset.i]); });
  U.topScroll($('val'));

  Promise.all([U.fetchJSON('live.json'), U.fetchJSON('../data/trade_notes.json').catch(function () { return null; })]).then(function (r) {
    L = r[0]; NOTES = (r[1] && r[1].trades) || {}; render();
  }).catch(function (e) { $('main').setAttribute('aria-busy', 'false'); $('metaLine').innerHTML = '<div class="empty" role="alert" style="width:100%"><strong>Couldn’t load the account</strong>' + esc(e.message) + '</div>'; });
});
