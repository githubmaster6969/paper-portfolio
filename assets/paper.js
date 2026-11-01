/* Paper Portfolio main page. Reads data/portfolio.json (+ holdings.json, options.json, trade_notes.json, about.json, setups.json, buy_notes.json). */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var U = window.PP, $ = U.$, esc = U.esc, money = U.money, smoney = U.smoney, pct = U.pct, cls = U.cls, r2 = U.r2;
  var NAMES = { S: 'Safe Core', D: 'Diversifier', A: 'Aggressive AI & Energy' };
  var SLEEVE_BY_NAME = { 'Safe Core': 'S', 'Diversifier': 'D', 'Aggressive AI & Energy': 'A' };
  var SC = { S: '#2563EB', D: '#8B5CF6', A: '#F59E0B', CASH: '#CBD5E1' };
  var ORDER = ['S', 'D', 'A'];
  var START_CASH = 10000;
  var GREEN = '#0A9F5A', RED = '#E0383E', GRAY = '#9AA0AB';
  var D = null, HJ = null, OPT = null, NOTES = {}, HS = [], ABOUT = {}, SETUPS = {}, BUYN = {};
  var st = { mode: 'pct', range: 'all', priceT: null, mover: 'today', sort: 'value', collapsed: {}, donutSel: null, tradeFilter: 'all', setupF: 'all', tickF: 'all', tradeN: 5, buyN: 5, buyTick: 'all', buySleeve: 'all', selT: null, selK: null };
  var mainChart = null, donut = null, eqChart = null, sheetChart = null;

  function contribAt(i) { var c = D.series.CONTRIB; return c && c[i] != null ? c[i] : START_CASH; }
  function contrib() { return D.contrib || START_CASH; }
  function hist(t) { var h = D.history && D.history[t]; return Array.isArray(h) && h.length === D.dates.length ? h : null; }
  function dow(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(+m[1], m[2] - 1, +m[3]).getDay()] : ''; }
  function initials(t) { return t.length <= 4 ? t : t.slice(0, 4); }

  function calc() {
    return D.holdings.map(function (h) {
      var value = h.sh * h.price, prevV = h.sh * h.prev, cost = h.sh * h.buy;
      return { t: h.t, p: h.p, sh: h.sh, buy: h.buy, price: h.price, prev: h.prev, value: value, cost: cost,
        todayChg: value - prevV, todayPct: prevV > 0 ? (value / prevV - 1) * 100 : 0,
        pl: value - cost, plPct: cost > 0 ? (value / cost - 1) * 100 : 0 };
    });
  }
  /* index of the last close before the current week (Mon-based) */
  function weekBaseIdx() {
    var n = D.dates.length, last = D.dates[n - 1].split('-').map(Number);
    var dt = new Date(last[0], last[1] - 1, last[2]), back = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - back);
    var mon = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    var idx = 0; D.dates.forEach(function (d, i) { if (d < mon) idx = i; }); return idx;
  }
  function weekStats(h) {
    var hi = hist(h.t), b = weekBaseIdx(), base = hi && hi[b] != null ? hi[b] : null;
    if (base == null || !base) return { chg: 0, pct: 0, ok: false };
    return { chg: h.sh * (h.price - base), pct: (h.price / base - 1) * 100, ok: true, base: base, baseDate: D.dates[b] };
  }

  /* ================= header / hero ================= */
  function renderMeta() {
    var parts = ['<span>Started <b>' + esc(U.dLong(D.start)) + '</b> with ' + money(START_CASH, 0) + '</span>',
      '<span>Last updated <b>' + esc(U.stamp(D.asOf)) + '</b></span>',
      '<span>' + (D.intraday ? 'Live intraday prices' : 'Prices as of the ' + esc(U.dLong(D.lastClose)) + ' close') + '</span>'];
    $('metaLine').innerHTML = parts.join('');
    var f = Array.isArray(D.failed) ? D.failed : [];
    $('alerts').innerHTML = f.length ? '<div class="empty" role="status" style="margin-bottom:16px;text-align:left"><strong>Price update missed ' + f.length + ' ticker' + (f.length > 1 ? 's' : '') + '</strong>' +
      esc(f.map(function (x) { return typeof x === 'string' ? x : (x && (x.t || x.ticker)) || ''; }).join(', ')) + ' show their last known price.</div>' : '';
  }
  function renderHero() {
    var total = HS.reduce(function (s, h) { return s + h.value; }, 0) + (D.cash || 0);
    var tChg = HS.reduce(function (s, h) { return s + h.todayChg; }, 0), prev = total - tChg, tPct = prev > 0 ? tChg / prev * 100 : 0;
    var C = contrib(), pl = total - C, plPct = pl / C * 100;
    var spyVal = D.spy.sh * D.spy.price, spyPl = spyVal - C, spyPct = spyPl / C * 100;
    var invested = HS.reduce(function (s, h) { return s + h.cost; }, 0);
    $('total').innerHTML = U.moneyHtml(total);
    $('topVal').textContent = money(total);
    $('todayLine').innerHTML = '<span class="' + cls(tChg) + '">' + (tChg >= 0 ? '▲ ' : '▼ ') + smoney(tChg) + ' (' + pct(tPct) + ')</span><span class="lbl">' + (D.intraday ? 'today so far' : 'today') + '</span>';
    $('kpis').innerHTML =
      '<div class="kpi"><dt>Gain or loss since start</dt><dd class="' + cls(pl) + '">' + smoney(pl) + ' <small>' + pct(plPct) + '</small></dd></div>' +
      '<div class="kpi"><dt>Money put in</dt><dd>' + money(C) + '</dd></div>' +
      '<div class="kpi"><dt>Invested in stocks</dt><dd>' + money(invested) + '</dd></div>' +
      '<div class="kpi"><dt>Cash on the side</dt><dd>' + money(D.cash || 0) + '</dd></div>';
    /* one plain sentence instead of a scoreboard tag */
    var a = r2(plPct), b = r2(spyPct), diff = r2(a - b);
    function upDown(v) { return v > 0 ? 'up <b class="up">' + Math.abs(v).toFixed(2) + '%</b>' : v < 0 ? 'down <b class="dn">' + Math.abs(v).toFixed(2) + '%</b>' : '<b>flat</b>'; }
    $('vsLine').innerHTML = 'Your portfolio is ' + upDown(a) + ' since ' + esc(U.dShort(D.start)) + '; the S&amp;P 500 (SPY) is ' + upDown(b) + ' with the same deposits on the same days, ' +
      (diff > 0 ? 'so you’re doing <b>' + Math.abs(diff).toFixed(2) + ' percentage points better</b>.' : diff < 0 ? 'so you’re <b>' + Math.abs(diff).toFixed(2) + ' percentage points behind</b>.' : 'so you’re exactly even.') +
      ' In dollars, SPY would be worth ' + money(spyVal) + '.';
    $('source').textContent = 'Prices from Webull. Hypothetical paper portfolio. Not real money and not financial advice.';
  }

  /* ================= performance chart ================= */
  function renderChart() {
    var n = D.dates.length;
    $('priceWrap').hidden = st.mode !== 'price';
    if (n < 2) { $('chartBox').innerHTML = '<div class="empty"><strong>Day 1</strong>The line shows up after the next close.</div>'; return; }
    var start = st.range === 'all' ? 0 : Math.max(0, n - 1 - st.range);
    var labels = D.dates.slice(start), sets = [], yTick = U.tickPct, lab, legend = '';
    $('rangeNote').textContent = 'Daily closes' + (D.intraday ? ' · last point is live' : '') + (st.range === 1 ? ' · 1D = latest vs prior close' : '');
    function ds(label, vals, col, o) { o = o || {}; return Object.assign({ label: label, data: vals, borderColor: col, backgroundColor: 'transparent', borderWidth: 2.25, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: col, tension: 0.25, fill: false }, o); }
    if (st.mode === 'pct') {
      var you = [], spy = [];
      for (var i = start; i < n; i++) { you.push(r2((D.series.T[i] / contribAt(i) - 1) * 100)); spy.push(r2((D.series.SPY[i] / contribAt(i) - 1) * 100)); }
      var col = you[you.length - 1] >= 0 ? GREEN : RED;
      sets.push(ds('You', you, col, { fill: 'origin', backgroundColor: col === GREEN ? 'rgba(10,159,90,.08)' : 'rgba(224,56,62,.07)' }));
      sets.push(ds('SPY', spy, GRAY, { borderDash: [5, 4], borderWidth: 1.75 }));
      lab = function (c) { return ' ' + c.dataset.label + '  ' + pct(c.raw); };
      legend = '<span style="--c:' + col + '"><i></i>You <b class="' + cls(you[you.length - 1]) + '">' + pct(you[you.length - 1]) + '</b></span><span style="--c:' + GRAY + '"><i class="dash"></i>SPY <b class="' + cls(spy[spy.length - 1]) + '">' + pct(spy[spy.length - 1]) + '</b></span><span class="flat">Return on money put in, since start. SPY gets the same deposits on the same days.</span>';
    } else if (st.mode === 'diff') {
      var dv = []; for (var k = start; k < n; k++) dv.push(r2(D.series.T[k] - D.series.SPY[k]));
      var last = dv[dv.length - 1];
      sets.push(ds('You minus SPY', dv, last >= 0 ? GREEN : RED, { fill: { target: 'origin', above: 'rgba(10,159,90,.10)', below: 'rgba(224,56,62,.09)' },
        segment: { borderColor: function (c) { return c.p1.parsed.y >= 0 ? GREEN : RED; } } }));
      yTick = function (v) { return (v > 0 ? '+' : '') + U.tickMoney(v); };
      lab = function (c) { return ' You vs SPY  ' + smoney(c.raw); };
      legend = '<span style="--c:' + (last >= 0 ? GREEN : RED) + '"><i></i>You minus SPY <b class="' + cls(last) + '">' + smoney(last) + '</b></span><span class="flat">Above zero means you have more money than if every deposit had gone into SPY</span>';
    } else if (st.mode === 'value') {
      var tv = D.series.T.slice(start), sv = D.series.SPY.slice(start), cv = labels.map(function (_, j) { return contribAt(start + j); });
      var chg = tv[tv.length - 1] - tv[0], c2 = chg >= 0 ? GREEN : RED;
      sets.push(ds('Your total', tv, c2, { fill: false }));
      sets.push(ds('SPY (same deposits)', sv, GRAY, { borderDash: [5, 4], borderWidth: 1.75 }));
      sets.push(ds('Money put in', cv, '#C9CDD4', { stepped: true, borderWidth: 1.5, tension: 0, borderDash: [2, 3] }));
      yTick = U.tickMoney; lab = function (c) { return ' ' + c.dataset.label + '  ' + money(c.raw); };
      legend = '<span style="--c:' + c2 + '"><i></i>You <b>' + money(tv[tv.length - 1]) + '</b></span><span style="--c:' + GRAY + '"><i class="dash"></i>SPY <b>' + money(sv[sv.length - 1]) + '</b></span><span style="--c:#C9CDD4"><i class="dash"></i>Put in <b>' + money(cv[cv.length - 1]) + '</b></span>';
    } else {
      var t = st.priceT, hi = hist(t), h = HS.filter(function (x) { return x.t === t; })[0];
      if (!hi) { mainChart = U.kill(mainChart); $('chartBox').innerHTML = '<div class="empty"><strong>No price history for ' + esc(t) + '</strong>It will fill in after the next close.</div>'; $('legend').innerHTML = ''; return; }
      var pv = hi.slice(start), first = null; pv.forEach(function (v) { if (first == null && v != null) first = v; });
      var c3 = pv[pv.length - 1] >= first ? GREEN : RED;
      sets.push(ds(t, pv, c3, { spanGaps: true }));
      if (h) sets.push(ds('Avg cost', labels.map(function () { return h.buy; }), '#6D5DF6', { borderDash: [4, 4], borderWidth: 1.25, pointHoverRadius: 0 }));
      yTick = U.tickMoney; lab = function (c) { return ' ' + c.dataset.label + '  ' + U.price(c.raw); };
      legend = '<span style="--c:' + c3 + '"><i></i>' + esc(t) + ' <b>' + U.price(pv[pv.length - 1]) + '</b> <span class="' + cls(pv[pv.length - 1] - first) + '">' + pct((pv[pv.length - 1] / first - 1) * 100) + ' in range</span></span>' + (h ? '<span style="--c:#6D5DF6"><i class="dash"></i>Avg cost <b>' + U.price(h.buy) + '</b></span>' : '');
    }
    $('legend').innerHTML = legend;
    if (!U.chartReady()) { $('chartBox').innerHTML = '<div class="empty"><strong>Chart library didn’t load</strong>The numbers above are unaffected.</div>'; return; }
    if (!$('mainCanvas')) $('chartBox').innerHTML = '<canvas id="mainCanvas" role="img" aria-label="Performance chart"></canvas>';
    var opts = U.lineOpts({ yTick: yTick, label: lab, zeroLine: st.mode === 'pct' || st.mode === 'diff', title: function (it) { return it[0] ? U.dLong(it[0].label) : ''; },
      xTick: function (v) { return U.dShort(this.getLabelForValue(v)); } });
    if (mainChart) { mainChart.data.labels = labels; mainChart.data.datasets = sets; mainChart.options = opts; mainChart.update(); }
    else mainChart = U.track(new Chart($('mainCanvas'), { type: 'line', plugins: [U.crosshair], data: { labels: labels, datasets: sets }, options: opts }));
    $('chartAlt').textContent = 'Chart from ' + U.dLong(labels[0]) + ' to ' + U.dLong(labels[labels.length - 1]) + '.';
  }

  /* ================= holdings ================= */
  function sorted(rows) {
    return rows.slice().sort(function (a, b) {
      if (st.sort === 'ticker') return a.t.localeCompare(b.t);
      if (st.sort === 'pl') return b.pl - a.pl;
      if (st.sort === 'today') return b.todayPct - a.todayPct;
      return b.value - a.value;
    });
  }
  function renderHoldings() {
    $('holdSub').textContent = HS.length + ' positions · tap any row for the full story';
    $('holdings').innerHTML = ORDER.map(function (k) {
      var rows = HS.filter(function (h) { return h.p === k; }); if (!rows.length) return '';
      var v = rows.reduce(function (s, h) { return s + h.value; }, 0), c = rows.reduce(function (s, h) { return s + h.cost; }, 0), open = !st.collapsed[k];
      return '<div class="hgroup" style="--c:' + SC[k] + '"><button type="button" class="g-btn" aria-expanded="' + open + '" data-g="' + k + '">' +
        '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="dot"></span><span class="g-name">' + esc(NAMES[k]) + '</span><span class="g-meta num">' + rows.length + ' · ' + money(v) + ' · <span class="' + cls(v - c) + '">' + pct((v / c - 1) * 100) + '</span></span></button>' +
        '<div id="grp-' + k + '"' + (open ? '' : ' hidden') + '><table class="htable num"><thead><tr><th>Ticker</th><th class="hide-m">Shares</th><th class="hide-m">Avg cost</th><th class="hide-m">Price</th><th>Value</th><th>P&amp;L</th><th>Today</th></tr></thead><tbody>' +
        sorted(rows).map(function (h) {
          return '<tr data-t="' + esc(h.t) + '"' + (st.selT === h.t ? ' class="sel"' : '') + ' tabindex="0" role="button" aria-label="' + esc(h.t) + ' details"><td class="tk">' + esc(h.t) + '<small class="show-m">' + U.shares(h.sh) + ' sh</small></td>' +
            '<td class="hide-m">' + U.shares(h.sh) + '</td><td class="hide-m">' + U.price(h.buy) + '</td><td class="hide-m">' + U.price(h.price) + '</td>' +
            '<td>' + money(h.value) + '</td><td class="pl ' + cls(h.pl) + '">' + smoney(h.pl) + '<small>' + pct(h.plPct) + '</small></td>' +
            '<td><span class="badge ' + cls(h.todayPct) + '">' + pct(h.todayPct) + '</span></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }).join('');
  }

  /* ================= movers ================= */
  function renderMovers() {
    var title = { today: 'Today’s movers', week: 'This week’s movers', start: 'Movers since start' }[st.mover];
    $('h-movers').textContent = title;
    var rows = HS.map(function (h) {
      if (st.mover === 'today') return { h: h, chg: h.todayChg, pct: h.todayPct };
      if (st.mover === 'week') { var w = weekStats(h); return { h: h, chg: w.chg, pct: w.pct, ok: w.ok }; }
      return { h: h, chg: h.pl, pct: h.plPct };
    });
    var wb = D.dates[weekBaseIdx()];
    $('moversSub').textContent = st.mover === 'today' ? 'Change since yesterday’s close' : st.mover === 'week' ? 'Change since the ' + U.dShort(wb) + ' close' : 'Change since we bought (vs what we paid)';
    var up = rows.filter(function (r) { return r2(r.pct) > 0; }).sort(function (a, b) { return b.pct - a.pct; }).slice(0, 4);
    var dn = rows.filter(function (r) { return r2(r.pct) < 0; }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 4);
    var i = 0;
    function item(r) {
      return '<button type="button" class="item' + (st.selT === r.h.t ? ' sel' : '') + '" style="--i:' + (i++) + '" data-t="' + esc(r.h.t) + '"><span class="ava" style="--c:' + SC[r.h.p] + '">' + esc(initials(r.h.t)) + '</span>' +
        '<span class="main"><span class="t">' + esc(r.h.t) + '</span><span class="s" style="display:block">' + esc(NAMES[r.h.p]) + ' · ' + U.price(r.h.price) + '</span></span>' +
        '<span class="r num"><span class="a ' + cls(r.chg) + '" style="display:block">' + smoney(r.chg) + '</span><span class="badge ' + cls(r.pct) + '">' + pct(r.pct) + '</span></span></button>';
    }
    if (!up.length && !dn.length) { $('movers').innerHTML = '<div class="empty fade-swap"><strong>Quiet day</strong>Nothing has moved yet.</div>'; return; }
    $('movers').innerHTML = (up.length ? '<div class="movers-sec"><div class="eyebrow">Going up</div><div class="list anim-in">' + up.map(item).join('') + '</div></div>' : '') +
      (dn.length ? '<div class="movers-sec"><div class="eyebrow">Going down</div><div class="list anim-in">' + dn.map(item).join('') + '</div></div>' : '');
  }
  function markSel() {
    document.querySelectorAll('#movers [data-t], #holdings tr[data-t]').forEach(function (el) { el.classList.toggle('sel', el.dataset.t === st.selT); });
    document.querySelectorAll('#trades [data-k]').forEach(function (el) { el.classList.toggle('sel', el.dataset.k === st.selK); });
  }

  /* ================= donut ================= */
  function allocData() {
    var segs = ORDER.map(function (k) { var rows = HS.filter(function (h) { return h.p === k; }); return { k: k, name: NAMES[k], v: rows.reduce(function (s, h) { return s + h.value; }, 0), rows: rows, c: SC[k] }; });
    segs.push({ k: 'CASH', name: 'Cash', v: D.cash || 0, rows: [], c: SC.CASH });
    var tot = segs.reduce(function (s, x) { return s + x.v; }, 0); segs.forEach(function (x) { x.p = tot ? x.v / tot * 100 : 0; });
    return { segs: segs, tot: tot };
  }
  function renderDonut() {
    var a = allocData(), sel = st.donutSel != null ? a.segs[st.donutSel] : null;
    $('donutCenter').innerHTML = sel ? '<div><b class="num">' + sel.p.toFixed(1) + '%</b><span>' + esc(sel.name) + '<br>' + money(sel.v, 0) + '</span></div>' : '<div><b class="num">' + money(a.tot, 0) + '</b><span>total value</span></div>';
    $('allocList').innerHTML = a.segs.map(function (s, i) {
      var extra = '';
      if (sel === s && s.rows.length) extra = '<span class="x">' + s.rows.slice().sort(function (x, y) { return y.value - x.value; }).map(function (h) { return esc(h.t) + ' ' + (h.value / a.tot * 100).toFixed(1) + '%'; }).join(' · ') + '</span>';
      else if (sel === s && s.k === 'CASH') extra = '<span class="x">Waiting for the next dip</span>';
      return '<button type="button" data-i="' + i + '" aria-pressed="' + (st.donutSel === i) + '" style="--c:' + s.c + '"><i></i><span>' + esc(s.name) + '</span><span class="p num">' + s.p.toFixed(1) + '%</span>' + extra + '</button>';
    }).join('');
    if (!U.chartReady()) return;
    var bg = a.segs.map(function (s, i) { return st.donutSel == null || st.donutSel === i ? s.c : s.c + '55'; });
    if (donut) { donut.data.datasets[0].data = a.segs.map(function (s) { return r2(s.v); }); donut.data.datasets[0].backgroundColor = bg; donut.update(); return; }
    donut = U.track(new Chart($('donut'), { type: 'doughnut',
      data: { labels: a.segs.map(function (s) { return s.name; }), datasets: [{ data: a.segs.map(function (s) { return r2(s.v); }), backgroundColor: bg, borderWidth: 2, borderColor: '#fff', hoverOffset: 6, borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', animation: U.REDUCE ? false : { duration: 400 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        onClick: function (e, els) { st.donutSel = els.length ? (st.donutSel === els[0].index ? null : els[0].index) : null; renderDonut(); },
        onHover: function (e, els) { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } } }));
  }

  /* ================= cash ================= */
  function nextFriday() {
    var led = D.ledger || [], last = led.length ? led[led.length - 1].date : D.start;
    var now = new Date(), today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var from = last >= today ? last : today, p = from.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
    if (from === last) d.setDate(d.getDate() + 1);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function renderCash() {
    var led = D.ledger || [], buys = D.buys || [];
    var spent = buys.reduce(function (s, b) { return s + (b.amount || 0); }, 0);
    var fridays = led.filter(function (x) { return /weekly/i.test(x.note || ''); });
    var other = led.filter(function (x) { return !/weekly/i.test(x.note || ''); });
    var html = '<p class="cash-sum num">Started with <b>' + money(START_CASH, 0) + '</b> on ' + esc(U.dShort(D.start)) +
      other.map(function (x) { return ', added <b>' + money(x.amount, 0) + '</b> on ' + esc(U.dShort(x.date)); }).join('') +
      (fridays.length ? ', plus <b>' + money(800, 0) + ' every Friday</b> (' + fridays.length + ' so far)' : '') +
      '. <b>' + money(contrib(), 0) + '</b> put in total; ' + money(spent, 0) + ' of it spent on ' + buys.length + ' dip buys, <b>' + money(D.cash || 0, 0) + '</b> cash left.</p>' +
      '<div class="next-dep num"><span class="ic" aria-hidden="true">＋</span><span>Next deposit: <b>' + money(800, 0) + ' on ' + esc(dow(nextFriday())) + ', ' + esc(U.dShort(nextFriday())) + '</b>. The plan is ' + money(800, 0) + ' every Friday for 6 to 12 months. SPY gets the same deposits, so the comparison stays fair.</span></div>';
    var items = [{ d: D.start, ic: '★', t: 'Starting money', s: dow(D.start) + ', ' + U.dLong(D.start), a: '+' + money(START_CASH) }];
    led.forEach(function (x) {
      var friday = /weekly/i.test(x.note || '');
      items.push({ d: x.date, ic: '＋', t: friday ? 'Friday deposit' : 'Extra cash for buying dips',
        s: dow(x.date) + ', ' + U.dLong(x.date) + (x.spy_price ? ' · SPY bought with the same money at ' + U.price(x.spy_price) : ''), a: '+' + money(x.amount) });
    });
    items.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    html += '<details class="fold"><summary><span>Deposit history</span><span class="cnt">' + items.length + ' deposits</span><svg class="chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>' +
      '<ul class="tl num">' + items.map(function (x) { return '<li><span class="ic">' + x.ic + '</span><span><span class="t" style="display:block">' + esc(x.t) + '</span><span class="s">' + esc(x.s) + '</span></span><span class="a up">' + esc(x.a) + '</span></li>'; }).join('') + '</ul></details>';
    $('cashBody').innerHTML = html;
  }

  /* ================= grouping / show more helpers ================= */
  function monday(iso) { var p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var CHEV = '<svg class="chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function grouped(items, dateOf, render, meta) {
    var groups = [], map = {};
    items.forEach(function (x) { var k = monday(dateOf(x)); if (!map[k]) { map[k] = []; groups.push(k); } map[k].push(x); });
    return groups.map(function (k) {
      return '<details class="grp" open><summary>' + CHEV + '<span>Week of ' + esc(U.dShort(k)) + '</span><span class="meta num">' + meta(map[k]) + '</span></summary>' + render(map[k]) + '</details>';
    }).join('');
  }
  function moreRow(el, shown, total, key, rerender) {
    el.innerHTML = total > shown ? '<span class="note" style="margin:0">Showing ' + shown + ' of ' + total + '</span><button type="button" class="btn" data-m="5">Show more</button><button type="button" class="btn sm" data-m="all">Show all</button>'
      : total > 5 ? '<span class="note" style="margin:0">Showing all ' + total + '</span><button type="button" class="btn sm" data-m="less">Show latest 5</button>' : '';
    el.onclick = function (e) { var b = e.target.closest('[data-m]'); if (!b) return; var m = b.dataset.m; st[key] = m === 'all' ? 1e9 : m === 'less' ? 5 : st[key] + 5; rerender(); };
  }
  function opts(sel, list, allLabel, cur) { sel.innerHTML = '<option value="all">' + esc(allLabel) + '</option>' + list.map(function (x) { return '<option value="' + esc(x) + '"' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }

  /* ================= buy cards ================= */
  function buyKey(b) { return b.date + '|' + b.time_et + '|' + b.ticker; }
  function sh2(x) { return (+x).toFixed(2); }
  function buyWhat(b) {
    var r = b.reason || '', tk = b.ticker, m = /~?([\d.]+)% below (?:its )?20-day closing high ([\d.]+)/i.exec(r);
    var r2hit = b.rule === 'R2' || /^R2\b/.test(r);
    if (m) return tk + ' slid ' + (+m[1]).toFixed(1) + '% below its high of the last 20 trading days' + (r2hit ? ', dipped to a price floor we had written down ahead of time, and bounced' : '') + '.';
    if (r2hit) return tk + ' dipped to a price floor we had written down ahead of time and bounced back above it.';
    return '';
  }
  function buyCard(b) {
    var bn = BUYN[buyKey(b)] || {}, h = HS.filter(function (x) { return x.t === b.ticker; })[0];
    var since = h ? (h.price / b.price - 1) * 100 : null, what = bn.what || buyWhat(b), why = bn.why_this || '';
    var notLogged = !why || /^not logged/i.test(why);
    return '<article class="why"><div class="why-h"><span style="display:flex;align-items:center;gap:12px;min-width:0"><span class="ava" style="--c:' + SC[SLEEVE_BY_NAME[b.portfolio]] + ';width:36px;height:36px;font-size:11px">' + esc(initials(b.ticker)) + '</span>' +
      '<span><span class="bought num" style="display:block">' + money(b.amount, 0) + ' bought ' + sh2(b.shares) + ' shares of ' + esc(b.ticker) + ' at ' + U.price(b.price) + '</span><span class="s" style="display:block;font-size:12.5px;color:var(--muted)">' + esc(dow(b.date)) + ', ' + esc(U.dt(b.date, b.time_et)) + ' · ' + esc(b.portfolio || '') + '</span></span></span>' +
      (since != null ? '<span class="badge ' + cls(since) + ' num" title="Change since this buy">' + pct(since) + ' since</span>' : '') + '</div>' +
      '<p class="what"><b>What happened:</b> ' + (what ? esc(what) : '<span class="nl">Not logged</span>') + '</p>' +
      '<p class="why-this"><b>Why this stock:</b> ' + (notLogged ? '<span class="nl">' + esc(why || 'Not logged.') + '</span>' : esc(why)) + '</p></article>';
  }
  function renderBuys() {
    var all = (D.buys || []).slice().sort(function (a, b) { return (b.date + b.time_et) < (a.date + a.time_et) ? -1 : 1; });
    var list = all.filter(function (b) { return (st.buyTick === 'all' || b.ticker === st.buyTick) && (st.buySleeve === 'all' || b.portfolio === st.buySleeve); });
    $('buyCount').textContent = list.length + ' of ' + all.length + ' buys';
    if (!all.length) { $('buyCards').innerHTML = '<div class="empty"><strong>No dip buys yet</strong>Cash waits for a real pullback.</div>'; $('buyMore').innerHTML = ''; return; }
    var shown = list.slice(0, st.buyN);
    $('buyCards').innerHTML = shown.length ? grouped(shown, function (b) { return b.date; }, function (xs) { return xs.map(buyCard).join(''); },
      function (xs) { return xs.length + ' buy' + (xs.length > 1 ? 's' : '') + ' · ' + money(xs.reduce(function (s, b) { return s + b.amount; }, 0), 0); }) : '<div class="empty">No buys match these filters</div>';
    moreRow($('buyMore'), shown.length, list.length, 'buyN', renderBuys);
  }
  function aboutHtml(t) {
    var a = ABOUT[t]; if (!a) return '';
    var rows = '';
    if (a.kind === 'etf') {
      rows = '<div><dt>What it follows</dt><dd>' + esc(a.tracks || '–') + '</dd></div><div><dt>Yearly fee</dt><dd>' + (a.expenseRatio != null ? (+a.expenseRatio).toFixed(2) + '%' : '–') + '</dd></div><div><dt>Earnings</dt><dd style="font-weight:400;font-size:13.5px">Funds don’t report earnings</dd></div>';
    } else {
      var le = a.lastEarnings, ne = a.nextEarnings, cur = le && le.currency === 'CAD' ? 'C$' : '$';
      function big(v) { return v == null ? '–' : cur + (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : (v / 1e6).toFixed(0) + 'M'); }
      rows = '<div><dt>Next earnings</dt><dd>' + (ne && ne.date ? esc(U.dLong(ne.date)) + '<span class="s" style="display:block;font-size:12px;font-weight:400;color:var(--muted)">' + (ne.confirmed ? 'Confirmed by the company' : 'Expected date, not confirmed yet') + '</span>' : '<span class="nl">Not found</span>') + '</dd></div>' +
        '<div><dt>Latest earnings</dt><dd>' + (le && le.date ? esc(U.dLong(le.date)) : '<span class="nl">Not found</span>') + '</dd></div>' +
        '<div><dt>Profit per share</dt><dd>' + (le && le.eps != null ? cur + (+le.eps).toFixed(2) + (le.epsEst != null ? '<span class="s" style="display:block;font-size:12px;font-weight:400;color:var(--muted)">' + (le.eps >= le.epsEst ? 'Beat' : 'Missed') + ' the ' + cur + (+le.epsEst).toFixed(2) + ' expected</span>' : '') : '–') + '</dd></div>';
      if (le && le.revenue != null) rows += '<div><dt>Sales that quarter</dt><dd>' + big(le.revenue) + (le.revenueEst != null ? '<span class="s" style="display:block;font-size:12px;font-weight:400;color:var(--muted)">' + (le.revenue >= le.revenueEst ? 'Beat' : 'Missed') + ' the ' + big(le.revenueEst) + ' expected</span>' : '') + '</dd></div>';
    }
    return '<h4>About ' + esc(a.name || t) + '</h4><div class="about"><p>' + esc(a.about || '') + '</p><dl class="kv ' + (a.kind === 'etf' ? 'k3 ' : '') + 'num facts">' + rows + '</dl>' + (a.source ? '<div class="src">Source: ' + esc(U.usDates(a.source)) + '</div>' : '') + '</div>';
  }

  /* ================= holding detail modal ================= */
  function openHolding(t) {
    var h = HS.filter(function (x) { return x.t === t; })[0]; if (!h) return;
    st.selT = t; markSel();
    var lots = [];
    (HJ && HJ.holdings || []).forEach(function (x) { if (x.ticker === t && x.shares > 0) lots.push({ d: x.date, time: '', sh: x.shares, px: x.buy_price, amt: x.cost_basis, base: true }); });
    var buys = (D.buys || []).filter(function (b) { return b.ticker === t; });
    buys.forEach(function (b) { lots.push({ d: b.date, time: b.time_et, sh: b.shares, px: b.price, amt: b.amount, b: b }); });
    lots.sort(function (a, b) { return (a.d + a.time) < (b.d + b.time) ? -1 : 1; });
    var first = lots[0];
    var w = weekStats(h), nm = ABOUT[t] && ABOUT[t].name;
    var head = '<h3 id="sheetTitle">' + esc(t) + (nm ? ' <span class="flat" style="font-weight:400;font-size:16px">' + esc(nm) + '</span>' : '') + '</h3><div class="s">' + esc(NAMES[h.p]) + ' · ' + U.price(h.price) + ' <span class="' + cls(h.todayPct) + '">' + pct(h.todayPct) + ' today</span></div>';
    var body = '<div class="big num" style="font-size:34px">' + U.moneyHtml(h.value) + '</div><div class="delta num"><span class="' + cls(h.pl) + '">' + smoney(h.pl) + ' (' + pct(h.plPct) + ')</span><span class="lbl">since we bought</span></div>' +
      '<div class="chart-box" style="height:210px;margin-top:16px" id="hBox"></div><div class="legend" style="margin-top:8px"><span style="--c:' + (h.pl >= 0 ? GREEN : RED) + '"><i></i>Daily closing price</span><span style="--c:#6D5DF6"><i class="dash"></i>Average price we paid ' + U.price(h.buy) + '</span><span>● a buy</span></div>' +
      aboutHtml(t) +
      '<h4>Our position</h4><dl class="kv k3 num">' +
      '<div><dt>Money invested</dt><dd>' + money(h.cost) + '</dd></div><div><dt>Shares</dt><dd>' + U.shares(h.sh) + '</dd></div><div><dt>Average price paid</dt><dd>' + U.price(h.buy) + '</dd></div>' +
      '<div><dt>Worth now</dt><dd>' + money(h.value) + '</dd></div><div><dt>Gain or loss</dt><dd class="' + cls(h.pl) + '">' + smoney(h.pl) + '</dd></div><div><dt>Return</dt><dd class="' + cls(h.plPct) + '">' + pct(h.plPct) + '</dd></div>' +
      '<div><dt>Today</dt><dd class="' + cls(h.todayChg) + '">' + smoney(h.todayChg) + '</dd></div><div><dt>This week</dt><dd class="' + cls(w.pct) + '">' + (w.ok ? pct(w.pct) : '–') + '</dd></div><div><dt>First bought</dt><dd>' + (first ? esc(U.dShort(first.d)) : '–') + '</dd></div></dl>' +
      '<h4>Buy history</h4>' + (lots.length ? '<ul class="tl num">' + lots.map(function (l) {
        return '<li><span class="ic b">' + (l.base ? '★' : '＋') + '</span><span><span class="t" style="display:block">' + money(l.amt, 0) + ' bought ' + sh2(l.sh) + ' shares at ' + U.price(l.px) + '</span><span class="s">' + (l.base ? 'Starting position · ' : 'Dip buy · ') + esc(U.dt(l.d, l.time)) + '</span></span></li>';
      }).join('') + '</ul>' : '<p class="nl">Buy history not logged</p>') +
      '<h4>Why we added</h4>' + (buys.length ? buys.slice().reverse().map(buyCard).join('') : '<p>Part of the starting portfolio on ' + esc(U.dLong(D.start)) + ' (' + esc(NAMES[h.p]) + '). No extra buys since.</p>');
    U.openSheet(head, body, function () {
      var hi = hist(t); if (!hi || !U.chartReady()) { $('hBox').innerHTML = '<div class="empty">No price history yet</div>'; return; }
      var radius = D.dates.map(function (d) { return lots.some(function (l) { return l.d === d; }) ? 5 : 0; });
      $('hBox').innerHTML = '<canvas role="img" aria-label="' + esc(t) + ' price history"></canvas>';
      sheetChart = U.kill(sheetChart);
      sheetChart = U.track(new Chart($('hBox').firstChild, { type: 'line', plugins: [U.crosshair],
        data: { labels: D.dates, datasets: [
          { label: t, data: hi, borderColor: h.pl >= 0 ? GREEN : RED, borderWidth: 2, pointRadius: radius, pointBackgroundColor: '#6D5DF6', pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 4, tension: .25, spanGaps: true },
          { label: 'Avg paid', data: D.dates.map(function () { return h.buy; }), borderColor: '#6D5DF6', borderDash: [4, 4], borderWidth: 1.25, pointRadius: 0, pointHoverRadius: 0 }] },
        options: U.lineOpts({ yTick: U.tickMoney, maxX: 5, label: function (c) { return ' ' + c.dataset.label + '  ' + U.price(c.raw); }, title: function (it) { return it[0] ? U.dLong(it[0].label) : ''; }, xTick: function (v) { return U.dShort(this.getLabelForValue(v)); } }) }));
    }, function () { sheetChart = U.kill(sheetChart); });
  }

  /* ================= options analyzer ================= */
  function groupTrades(o) {
    var map = {}, list = [];
    (o.closed || []).forEach(function (r) {
      var k = r.entryDate + '|' + r.entryTime + '|' + r.ticker;
      if (!map[k]) { map[k] = { key: k, rows: [], ticker: r.ticker, entryDate: r.entryDate, entryTime: r.entryTime, realized: 0, cost: 0 }; list.push(map[k]); }
      map[k].rows.push(r); map[k].realized += r.realized || 0;
    });
    list.forEach(function (t) {
      var seen = {};
      t.rows.forEach(function (r) { t.cost += (r.entry || 0) * (r.qty || 0) * 100; seen[r.contract] = (seen[r.contract] || 0) + r.qty; });
      var contracts = Object.keys(seen); t.contracts = contracts;
      t.note = NOTES['paper|' + t.key] || null;
      t.qty = contracts.length > 1 ? seen[contracts[0]] : seen[contracts[0]];
      t.label = contracts.length > 1 ? t.ticker + ' ' + contracts.map(function (c) { return c.split(' ').pop(); }).join(' + ') : contracts[0];
      t.type = contracts.length > 1 ? 'Straddle' : (t.rows[0].type === 'put' ? 'Put' : 'Call');
      t.expiry = t.rows[0].expiry;
      t.pct = t.cost ? t.realized / t.cost * 100 : 0;
      t.res = r2(t.realized) > 0 ? 'win' : r2(t.realized) < 0 ? 'loss' : 'flat';
      t.exitAt = t.note && t.note.exitAt ? t.note.exitAt : t.entryDate + 'T' + t.entryTime;
      t.entryPx = t.note && t.note.entryPrice != null ? t.note.entryPrice : t.rows[0].entry;
      var q = t.rows.reduce(function (s, r) { return s + r.qty; }, 0);
      t.exitPx = t.note && t.note.exitPrice != null ? t.note.exitPrice : (contracts.length > 1 ? t.rows.reduce(function (s, r) { return s + r.exit; }, 0) : t.rows.reduce(function (s, r) { return s + r.exit * r.qty; }, 0) / q);
    });
    return list;
  }
  function ring(p) {
    var R = 15, C = 2 * Math.PI * R, f = Math.max(0, Math.min(1, p / 100));
    return '<svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="' + R + '" fill="none" stroke="#FDECEC" stroke-width="5"/><circle cx="19" cy="19" r="' + R + '" fill="none" stroke="' + GREEN + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (C * f).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 19 19)"/></svg>';
  }
  function renderOptions(o) {
    var T = groupTrades(o);
    var wins = T.filter(function (t) { return t.res === 'win'; }), losses = T.filter(function (t) { return t.res === 'loss'; });
    var sw = wins.reduce(function (s, t) { return s + t.realized; }, 0), sl = losses.reduce(function (s, t) { return s + t.realized; }, 0);
    var wr = T.length ? wins.length / T.length * 100 : 0;
    var budget = o.budget || 5000;
    $('optAsOf').textContent = 'Updated ' + U.stamp(o.asOf);
    function stat(k, v, x, c, extra) { return '<div class="stat">' + (extra || '') + '<div class="k">' + k + '</div><div class="v num ' + (c || '') + '">' + v + '</div><div class="x num">' + x + '</div></div>'; }
    $('optStats').innerHTML =
      stat('Account value', money(o.equity), 'Started with ' + money(budget, 0)) +
      stat('Total gain or loss', smoney(o.totalPnl), pct(o.totalPct) + ' of the budget', cls(o.totalPnl)) +
      stat('Win rate', Math.round(wr) + '%', wins.length + ' wins · ' + losses.length + ' losses', '', '<span class="ring">' + ring(wr) + '</span>') +
      stat('Average win', wins.length ? smoney(sw / wins.length, 0) : '–', 'Best ' + (wins.length ? smoney(Math.max.apply(null, wins.map(function (t) { return t.realized; })), 0) : '–'), 'up') +
      stat('Average loss', losses.length ? smoney(sl / losses.length, 0) : '–', 'Worst ' + (losses.length ? smoney(Math.min.apply(null, losses.map(function (t) { return t.realized; })), 0) : '–'), 'dn') +
      stat('Won per $1 lost', sl ? '$' + (sw / Math.abs(sl)).toFixed(2) : '–', 'Total won ÷ total lost');
    /* equity curve, ordered by exit time */
    var byExit = T.slice().sort(function (a, b) { return a.exitAt < b.exitAt ? -1 : 1; });
    var labels = ['Start'], vals = [budget], meta = [null], run = budget;
    byExit.forEach(function (t) { run += t.realized; labels.push(U.dShort(t.exitAt)); vals.push(r2(run)); meta.push(t); });
    if (U.chartReady()) {
      eqChart = U.kill(eqChart);
      $('eqBox').innerHTML = '<canvas role="img" aria-label="Options account value after each trade"></canvas>';
      var col = run >= budget ? GREEN : RED;
      eqChart = U.track(new Chart($('eqBox').firstChild, { type: 'line', plugins: [U.crosshair],
        data: { labels: labels, datasets: [{ label: 'Account', data: vals, borderColor: col, backgroundColor: 'rgba(10,159,90,.08)', fill: { target: { value: budget } }, borderWidth: 2.25, tension: .2,
          pointRadius: vals.map(function (_, i) { return i === 0 ? 0 : 4; }), pointBackgroundColor: meta.map(function (t) { return t && t.res === 'loss' ? RED : GREEN; }), pointBorderColor: '#fff', pointBorderWidth: 1.5, pointHoverRadius: 7, pointHitRadius: 10 },
          { label: 'Budget', data: vals.map(function () { return budget; }), borderColor: '#C9CDD4', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, pointHoverRadius: 0 }] },
        options: (function () {
          var op = U.lineOpts({ yTick: U.tickMoney, maxX: 6, title: function (it) { var t = meta[it[0].dataIndex]; return t ? PPTrade.name(t.contracts) + ' · closed ' + U.dLong(t.exitAt) : 'Starting budget'; },
            label: function (c) { if (c.datasetIndex) return null; var t = meta[c.dataIndex]; return t ? ' ' + smoney(t.realized) + '  →  ' + money(c.raw) + '  (click for details)' : ' ' + money(c.raw); } });
          op.onClick = function (e, els) { var el = els.filter(function (x) { return x.datasetIndex === 0; })[0]; if (el && meta[el.index]) openTrade(meta[el.index]); };
          op.onHover = function (e, els) { e.native.target.style.cursor = els.some(function (x) { return x.datasetIndex === 0 && x.index > 0; }) ? 'pointer' : 'default'; };
          op.plugins.tooltip.filter = function (it) { return it.datasetIndex === 0; };
          return op;
        })() }));
    }
    /* by setup */
    var setups = {};
    T.forEach(function (t) { var s = t.note && t.note.setup || 'Setup not logged'; (setups[s] = setups[s] || { n: 0, w: 0, l: 0, pnl: 0 }); setups[s].n++; setups[s].pnl += t.realized; if (t.res === 'win') setups[s].w++; if (t.res === 'loss') setups[s].l++; });
    var sk = Object.keys(setups).sort(function (a, b) { return setups[b].pnl - setups[a].pnl; });
    var mx = Math.max.apply(null, sk.map(function (k) { return Math.abs(setups[k].pnl); }).concat([1]));
    $('setups').innerHTML = sk.map(function (k) {
      var s = setups[k], wpx = Math.abs(s.pnl) / mx * 50, g = SETUPS.setups && SETUPS.setups[k];
      return '<div class="setup-row num"><span><span class="n">' + esc(k) + '</span><span class="m" style="display:block">' + (g ? esc(g.short) + ' ' : '') + s.n + ' trade' + (s.n > 1 ? 's' : '') + ', ' + s.w + ' won, ' + s.l + ' lost.</span></span>' +
        '<span class="' + cls(s.pnl) + '" style="font-weight:600;align-self:center">' + smoney(s.pnl, 0) + '</span>' +
        '<span class="bar"><span class="mid"></span><b style="background:' + (s.pnl >= 0 ? GREEN : RED) + ';' + (s.pnl >= 0 ? 'left:50%' : 'right:50%') + ';width:' + wpx.toFixed(1) + '%"></b></span></div>';
    }).join('') || '<div class="empty">No closed trades yet</div>';
    /* setups explained */
    var G = SETUPS.setups || {}, gk = Object.keys(G);
    var stCls = { Active: 'green', Retired: 'gray', 'Testing on paper': 'violet' };
    $('gloss').innerHTML = gk.length ? gk.map(function (k) {
      var g = G[k], s = setups[k];
      return '<div class="g"><h3>' + esc(k) + (g.status ? ' <span class="tag ' + (stCls[g.status] || 'gray') + '">' + esc(g.status) + '</span>' : '') + '</h3><p class="short">' + esc(g.short || '') + '</p><p>' + esc(g.text || '') + '</p>' +
        '<div class="stats num">' + (s ? s.n + ' trade' + (s.n > 1 ? 's' : '') + ' so far · ' + s.w + ' won · ' + s.l + ' lost · ' + smoney(s.pnl, 0) : 'No paper trades with this setup yet') + '</div></div>';
    }).join('') : '<p class="nl">Setup notes not available</p>';
    var TM = SETUPS.terms || {}, tk = Object.keys(TM);
    $('termsCnt').textContent = tk.length + ' terms';
    $('terms').innerHTML = tk.map(function (k) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(TM[k]) + '</dd></div>'; }).join('');
    $('termsFold').hidden = !tk.length;
    /* open */
    var op = o.open || [];
    $('optOpen').innerHTML = op.length ? '<div class="list">' + op.map(function (p, i) {
      return '<button type="button" class="item" data-open="' + i + '"><span class="ava" style="--c:#6D5DF6">' + esc(initials(p.ticker || '')) + '</span><span class="main"><span class="t">' + esc(PPTrade.name([p.contract])) + '</span><span class="s" style="display:block">' + p.qty + ' contract' + (p.qty > 1 ? 's' : '') + ' · paid ' + U.price(p.entry) + ' · now ' + U.price(p.mark) + '</span></span>' +
        '<span class="r num"><span class="a" style="display:block">' + money(p.value) + '</span><span class="badge ' + cls(p.unrealized) + '">' + smoney(p.unrealized, 0) + ' · ' + pct(p.unrealizedPct, 0) + '</span></span></button>';
    }).join('') + '</div>' : '<div class="empty"><strong>No open trades right now</strong>Cash waits until the next setup shows up.</div>';
    $('optOpen').onclick = function (e) { var b = e.target.closest('[data-open]'); if (b) openOpenPaper(op[+b.dataset.open]); };
    /* journal filters */
    window.__trades = T;
    var setNames = Object.keys(setups).sort(), tks = T.map(function (t) { return t.ticker; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    opts($('setupSel'), setNames, 'All setups', st.setupF); opts($('tickSel'), tks, 'All tickers', st.tickF);
    renderTradeCards();
  }
  function renderTradeCards() {
    var T = (window.__trades || []).slice().sort(function (a, b) { return (b.entryDate + b.entryTime) < (a.entryDate + a.entryTime) ? -1 : 1; });
    var list = T.filter(function (t) { return (st.tradeFilter === 'all' || t.res === st.tradeFilter) && (st.setupF === 'all' || (t.note && t.note.setup) === st.setupF) && (st.tickF === 'all' || t.ticker === st.tickF); });
    $('tradeSub').textContent = T.length + ' closed trades, newest first. Tap one for the full story.';
    var shown = list.slice(0, st.tradeN);
    function card(t) {
      var n = t.note || {}, k = { news: 'News-driven', chart: 'Chart setup, no news', earnings: 'Earnings bet', override: 'Pedro’s call', test: 'Order test' }[n.why_type];
      return '<button type="button" class="tcard' + (st.selK === t.key ? ' sel' : '') + '" data-k="' + esc(t.key) + '"><div class="row1"><span class="ava" style="--c:' + (t.res === 'win' ? GREEN : t.res === 'loss' ? RED : GRAY) + '">' + esc(initials(t.ticker)) + '</span>' +
        '<span class="main"><span class="c" style="display:block">' + esc(PPTrade.name(t.contracts)) + (t.qty > 1 ? ' <span class="flat" style="font-weight:500">×' + t.qty + '</span>' : '') + '</span><span class="d">' + esc(dow(t.entryDate)) + ', ' + esc(U.dLong(t.entryDate)) + '</span></span>' +
        '<span class="pl num"><span class="a ' + cls(t.realized) + '" style="display:block">' + smoney(t.realized, 0) + '</span><span class="wl ' + t.res + '">' + (t.res === 'win' ? 'Win' : t.res === 'loss' ? 'Loss' : 'Flat') + ' ' + pct(t.pct, 1) + '</span></span></div>' +
        '<p class="why1">' + (n.plain_why ? esc(n.plain_why) : '<span class="nl">Reason not logged</span>') + '</p>' +
        '<div class="chips"><span class="chip v">' + esc(n.setup || 'Setup not logged') + '</span>' + (k ? '<span class="chip">' + esc(k) + '</span>' : '') + (n.why_check && n.why_check.level === 'weak' ? '<span class="chip y">Thin reasoning</span>' : '') + (n.grade && n.grade !== 'n/a' ? '<span class="chip">Grade ' + esc(n.grade) + '</span>' : '') + '</div></button>';
    }
    $('trades').innerHTML = shown.length ? grouped(shown, function (t) { return t.entryDate; }, function (xs) { return '<div class="trade-grid">' + xs.map(card).join('') + '</div>'; },
      function (xs) { var p = xs.reduce(function (s, t) { return s + t.realized; }, 0); return xs.length + ' trade' + (xs.length > 1 ? 's' : '') + ' · <span class="' + cls(p) + '">' + smoney(p, 0) + '</span>'; }) : '<div class="empty">No trades match these filters</div>';
    moreRow($('tradeMore'), shown.length, list.length, 'tradeN', renderTradeCards);
  }
  function openTrade(t) {
    st.selK = t.key; markSel();
    var n = t.note || {};
    var v = PPTrade.render({ contracts: t.contracts, qty: t.qty, res: t.res, realized: t.realized, pct: t.pct, cost: t.cost, entryPx: t.entryPx, exitPx: t.exitPx,
      entryDate: t.entryDate, entryTime: t.entryTime, fills: t.rows }, n, '');
    U.openSheet(v.head, v.body, v.after);
  }
  function openOpenPaper(p) {
    var head = '<h3 id="sheetTitle">' + esc(PPTrade.name([p.contract])) + '</h3><div class="s"><span class="wl open">Open</span> · ' + p.qty + ' contract' + (p.qty > 1 ? 's' : '') + ' · paper money</div>';
    var body = '<div class="big num" style="font-size:34px">' + money(p.value) + '</div><div class="delta num"><span class="' + cls(p.unrealized) + '">' + smoney(p.unrealized) + ' (' + pct(p.unrealizedPct) + ')</span><span class="lbl">unrealized</span></div>' +
      '<h4 style="margin-top:20px">Position</h4><dl class="kv k3 num"><div><dt>Paid (per share)</dt><dd>' + U.price(p.entry) + '</dd></div><div><dt>Worth now</dt><dd>' + U.price(p.mark) + '</dd></div><div><dt>' + esc(p.ticker) + '</dt><dd>' + U.price(p.underlying) + '</dd></div>' +
      '<div><dt>Stop</dt><dd>' + U.price(p.optStop) + '</dd></div><div><dt>Sell half at</dt><dd>' + U.price(p.optHalf) + '</dd></div><div><dt>Stock price target</dt><dd>' + U.price(p.stockTarget) + '</dd></div></dl>' +
      (p.stopNote ? '<p class="note">' + esc(p.stopNote) + '</p>' : '') + '<h4>Risk numbers (Greeks)</h4>' + window.PPGreeks(p.greeks, p.qty);
    U.openSheet(head, body);
  }

  /* ================= wire up ================= */
  function renderAll() {
    HS = calc();
    renderMeta(); renderHero(); renderChart(); renderHoldings(); renderMovers(); renderDonut(); renderCash(); renderBuys();
    $('main').setAttribute('aria-busy', 'false');
  }
  U.seg($('modeSeg'), function (v) { st.mode = v; renderChart(); });
  U.seg($('rangeSeg'), function (v) { st.range = v === 'all' ? 'all' : +v; renderChart(); });
  U.seg($('moverSeg'), function (v) { st.mover = v; renderMovers(); });
  U.seg($('tradeSeg'), function (v) { st.tradeFilter = v; st.tradeN = 5; renderTradeCards(); });
  $('setupSel').addEventListener('change', function () { st.setupF = this.value; st.tradeN = 5; renderTradeCards(); });
  $('tickSel').addEventListener('change', function () { st.tickF = this.value; st.tradeN = 5; renderTradeCards(); });
  $('buyTick').addEventListener('change', function () { st.buyTick = this.value; st.buyN = 5; renderBuys(); });
  $('buySleeve').addEventListener('change', function () { st.buySleeve = this.value; st.buyN = 5; renderBuys(); });
  $('priceSel').addEventListener('change', function () { st.priceT = this.value; renderChart(); });
  $('sortSel').addEventListener('change', function () { st.sort = this.value; renderHoldings(); });
  $('holdings').addEventListener('click', function (e) {
    var g = e.target.closest('.g-btn');
    if (g) { var k = g.dataset.g, open = g.getAttribute('aria-expanded') === 'true'; st.collapsed[k] = open; g.setAttribute('aria-expanded', String(!open)); $('grp-' + k).hidden = open; return; }
    var tr = e.target.closest('tr[data-t]'); if (tr) openHolding(tr.dataset.t);
  });
  $('holdings').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-t]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openHolding(tr.dataset.t); } });
  $('movers').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) openHolding(b.dataset.t); });
  $('allocList').addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (!b) return; var i = +b.dataset.i; st.donutSel = st.donutSel === i ? null : i; renderDonut(); });
  $('trades').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; var t = (window.__trades || []).filter(function (x) { return x.key === b.dataset.k; })[0]; if (t) openTrade(t); });
  U.topScroll($('total'));

  function opt(p) { return U.fetchJSON(p).catch(function () { return null; }); }
  Promise.all([U.fetchJSON('data/portfolio.json'), opt('data/holdings.json'), opt('data/options.json'), opt('data/trade_notes.json'), opt('data/about.json'), opt('data/setups.json'), opt('data/buy_notes.json')]).then(function (r) {
    D = r[0]; HJ = r[1]; OPT = r[2]; NOTES = (r[3] && r[3].trades) || {}; ABOUT = (r[4] && r[4].tickers) || {}; SETUPS = r[5] || {}; BUYN = (r[6] && r[6].buys) || {};
    var bt = (D.buys || []).map(function (b) { return b.ticker; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    var bs = (D.buys || []).map(function (b) { return b.portfolio; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    opts($('buyTick'), bt, 'All tickers', 'all'); opts($('buySleeve'), bs, 'All groups', 'all');
    var tks = D.holdings.map(function (h) { return h.t; }).filter(hist).sort();
    st.priceT = tks.indexOf('VOO') >= 0 ? 'VOO' : tks[0];
    $('priceSel').innerHTML = tks.map(function (t) { return '<option value="' + esc(t) + '"' + (t === st.priceT ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
    renderAll();
    if (OPT) renderOptions(OPT); else $('optStats').innerHTML = '<div class="empty" style="grid-column:1/-1">Options data unavailable right now</div>';
  }).catch(function (e) {
    $('main').setAttribute('aria-busy', 'false');
    $('metaLine').innerHTML = '<div class="empty" role="alert" style="width:100%"><strong>Couldn’t load portfolio data</strong>' + esc(e.message) + ' · <a href="">try again</a></div>';
  });
});

