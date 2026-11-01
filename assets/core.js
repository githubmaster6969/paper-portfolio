/* Shared helpers for the Paper Portfolio pages. Vanilla JS, no build step. */
(function (w) {
  'use strict';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var U = {};
  U.$ = function (id) { return document.getElementById(id); };
  U.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  U.r2 = function (x) { var v = Math.round(x * 100) / 100; return v === 0 ? 0 : v; };
  U.cls = function (x) { var v = U.r2(x); return v > 0 ? 'up' : v < 0 ? 'dn' : 'flat'; };
  U.money = function (x, dp) {
    if (x == null || !isFinite(x)) return '–';
    dp = dp == null ? 2 : dp; var v = U.r2(x);
    return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  };
  U.smoney = function (x, dp) { if (x == null || !isFinite(x)) return '–'; var v = U.r2(x); return (v > 0 ? '+' : '') + U.money(v, dp); };
  U.pct = function (x, dp) { if (x == null || !isFinite(x)) return '–'; dp = dp == null ? 2 : dp; var v = U.r2(x); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp) + '%'; };
  U.price = function (x) { return x == null ? '–' : '$' + Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 }); };
  U.shares = function (x) { return Number(x).toLocaleString('en-US', { maximumFractionDigits: 4 }); };
  U.moneyHtml = function (x) { var s = U.money(x), i = s.lastIndexOf('.'); return U.esc(s.slice(0, i)) + '<span class="cents">' + U.esc(s.slice(i)) + '</span>'; };

  /* ---- dates: always US format, never YYYY-MM-DD on screen ---- */
  function parts(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  U.dShort = function (iso) { var p = parts(iso); return p ? MON[p.m - 1] + ' ' + p.d : String(iso || ''); };              // Oct 30
  U.dLong = function (iso) { var p = parts(iso); return p ? MON[p.m - 1] + ' ' + p.d + ', ' + p.y : String(iso || ''); };     // Oct 30, 2026
  U.dNum = function (iso) { var p = parts(iso); return p ? p.m + '/' + p.d + '/' + p.y : String(iso || ''); };                // 10/30/2026
  U.time12 = function (hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ''); if (!m) return '';
    var h = +m[1], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m[2] + ' ' + ap;
  };
  U.usDates = function (s) { return String(s || '').replace(/\b(\d{4}-\d{2}-\d{2})\b/g, function (m) { return U.dLong(m); }); };
  U.dt = function (iso, hhmm) { var t = U.time12(hhmm); return U.dLong(iso) + (t ? ', ' + t + ' ET' : ''); };
  /* full ISO timestamp with zone -> Eastern display */
  U.stamp = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return String(iso || '');
    return d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
  };
  /* "2026-10-12T09:30" (Eastern wall-clock, no zone) -> parts */
  U.wall = function (s) { var a = String(s || '').split('T'); return { d: a[0], t: (a[1] || '').slice(0, 5) }; };

  /* ---- axis ticks: never long floats ---- */
  function trim(n, dp) { return String(+(+n).toFixed(dp)); }
  U.tickPct = function (v) { var a = Math.abs(v); var s = trim(v, a >= 10 ? 0 : a >= 1 ? 1 : 2); return (v > 0 ? '+' : '') + s.replace('-', '−') + '%'; };
  U.tickMoney = function (v) {
    var a = Math.abs(v), sg = v < 0 ? '−' : '';
    if (a >= 1e6) return sg + '$' + trim(a / 1e6, 2) + 'M';
    if (a >= 1e4) return sg + '$' + trim(a / 1e3, 1) + 'k';
    if (a >= 1000) return sg + '$' + Math.round(a).toLocaleString('en-US');
    if (a >= 100) return sg + '$' + trim(a, 0);
    return sg + '$' + trim(a, 2);
  };
  U.tickSMoney = function (v) { return (v > 0 ? '+' : '') + U.tickMoney(v); };

  /* ---- charts ---- */
  U.FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, "Segoe UI", Roboto, Arial, sans-serif';
  if (w.Chart) { w.Chart.defaults.font.family = U.FONT; }
  U.charts = [];
  U.REDUCE = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  U.crosshair = { id: 'crosshair', afterDraw: function (c) {
    var a = c.tooltip && c.tooltip.getActiveElements && c.tooltip.getActiveElements();
    if (!a || !a.length) return; var x = a[0].element.x, ctx = c.ctx, y = c.chartArea;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x, y.top); ctx.lineTo(x, y.bottom); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(11,13,18,.28)'; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.restore(); } };
  U.lineOpts = function (o) {
    o = o || {};
    return {
      responsive: true, maintainAspectRatio: false, animation: U.REDUCE ? false : { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
      layout: { padding: { top: 6, right: 2 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11,13,18,.92)', padding: 10, cornerRadius: 10, boxWidth: 8, boxHeight: 8, boxPadding: 4, caretSize: 0, usePointStyle: true,
          titleFont: { family: U.FONT, weight: '600', size: 12 }, bodyFont: { family: U.FONT, size: 12 },
          callbacks: { title: o.title || function (it) { return it[0] ? it[0].label : ''; }, label: o.label }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false },
          ticks: { color: '#9AA0AB', maxRotation: 0, autoSkip: true, autoSkipPadding: 18, maxTicksLimit: o.maxX || 7, font: { size: 11, family: U.FONT }, callback: o.xTick } },
        y: { position: 'right', border: { display: false }, grace: '8%',
          ticks: { color: '#9AA0AB', maxTicksLimit: 6, font: { size: 11, family: U.FONT }, callback: o.yTick, padding: 6 },
          grid: { color: function (c) { return o.zeroLine && c.tick.value === 0 ? '#C9CDD4' : '#F0F1F4'; } } }
      }
    };
  };
  U.track = function (chart) {
    U.charts.push(chart);
    var box = chart.canvas.parentNode;
    if (w.ResizeObserver && box) { var ro = new ResizeObserver(function () { if (chart.canvas && chart.canvas.isConnected) chart.resize(); }); ro.observe(box); chart.$ro = ro; }
    chart.canvas.addEventListener('mouseleave', function () { if (chart.$dead || !chart.canvas || !chart.canvas.isConnected) return; chart.tooltip.setActiveElements([], { x: 0, y: 0 }); chart.update('none'); });
    return chart;
  };
  U.kill = function (chart) {
    if (!chart) return null; chart.$dead = true; if (chart.$ro) chart.$ro.disconnect();
    U.charts = U.charts.filter(function (c) { return c !== chart; }); chart.destroy(); return null;
  };
  var rt; w.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { U.charts.forEach(function (c) { if (c.canvas && c.canvas.isConnected) c.resize(); }); }, 120); });
  U.chartReady = function () { return typeof w.Chart !== 'undefined'; };

  /* ---- detail modal (full-height sheet on phones, centered floating card on desktop) ---- */
  var lastFocus = null, onClose = null;
  function ensureSheet() {
    if (U.$('sheet')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="sheet-bg" id="sheetBg"></div><section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">' +
      '<div class="sheet-grab" aria-hidden="true"></div><header class="sheet-h"><div class="main" id="sheetHead"></div>' +
      '<button type="button" class="x-btn" id="sheetX" aria-label="Close">×</button></header><div class="sheet-b" id="sheetBody"></div></section>');
    U.$('sheetBg').addEventListener('click', U.closeSheet);
    U.$('sheetX').addEventListener('click', U.closeSheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && U.$('sheet').classList.contains('on')) U.closeSheet(); });
    /* swipe down to close on phones */
    var y0 = null, sh = U.$('sheet');
    sh.addEventListener('touchstart', function (e) { var b = U.$('sheetBody'); y0 = (b.scrollTop <= 0 || !b.contains(e.target)) ? e.touches[0].clientY : null; }, { passive: true });
    sh.addEventListener('touchend', function (e) { if (y0 != null && e.changedTouches[0].clientY - y0 > 90 && w.innerWidth < 900) U.closeSheet(); y0 = null; }, { passive: true });
  }
  U.openSheet = function (headHtml, bodyHtml, after, close) {
    ensureSheet(); void U.$('sheet').offsetWidth;
    if (onClose) { try { onClose(); } catch (e) {} }
    if (!U.$('sheet').classList.contains('on')) lastFocus = document.activeElement;
    onClose = close || null;
    U.$('sheetHead').innerHTML = headHtml; U.$('sheetBody').innerHTML = bodyHtml; U.$('sheetBody').scrollTop = 0;
    U.$('sheetBg').classList.add('on'); U.$('sheet').classList.add('on'); document.body.style.overflow = 'hidden';
    setTimeout(function () { U.$('sheetX').focus({ preventScroll: true }); }, 60);
    if (after) requestAnimationFrame(function () { after(U.$('sheetBody')); });
  };
  U.closeSheet = function () {
    if (!U.$('sheet')) return;
    U.$('sheetBg').classList.remove('on'); U.$('sheet').classList.remove('on'); document.body.style.overflow = '';
    if (onClose) { try { onClose(); } catch (e) {} onClose = null; }
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };

  U.nl = function (s, fallback) { return s ? '<p>' + U.esc(s) + '</p>' : '<p class="nl">' + (fallback || 'Not logged') + '</p>'; };
  U.fetchJSON = function (url) { return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' HTTP ' + r.status); return r.json(); }); };
  U.seg = function (el, cb) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled || !el.contains(b)) return;
      el.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      cb(b.dataset.v, b);
    });
  };
  U.topScroll = function (sentinel) {
    var top = document.querySelector('.top'); if (!top) return;
    var f = function () { top.classList.toggle('scrolled', w.scrollY > 4); var tv = U.$('topVal'); if (tv && sentinel) tv.classList.toggle('show', sentinel.getBoundingClientRect().bottom < 60); };
    w.addEventListener('scroll', f, { passive: true }); f();
  };
  w.PP = U;
})(window);

/* Plain-English Greeks panel, shared with /live. Reads optional {delta,gamma,theta,vega,iv}. */
window.PPGreeks = function (g, qty) {
  var U = window.PP, esc = U.esc;
  if (!g || ['delta', 'gamma', 'theta', 'vega'].every(function (k) { return g[k] == null; }))
    return '<div class="empty"><strong>Greeks not in this snapshot yet</strong>Once the pipeline saves delta, gamma, theta and vega for this contract, they show up here with a plain-English read.</div>';
  var n = (qty || 1) * 100;
  function f(v, dp) { return v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp); }
  function m(v) { return v == null ? '' : U.money(Math.abs(v * n)); }
  var cards = [
    ['Delta', f(g.delta, 2), g.delta == null ? 'Not reported' : 'If the stock moves $1, this position moves about ' + m(g.delta) + (g.delta >= 0 ? ' in the same direction.' : ' the opposite way.')],
    ['Theta', f(g.theta, 2), g.theta == null ? 'Not reported' : 'Time decay: about ' + m(g.theta) + ' ' + (g.theta < 0 ? 'melts away' : 'is gained') + ' each day, all else equal.'],
    ['Gamma', f(g.gamma, 3), g.gamma == null ? 'Not reported' : 'How fast delta changes: each $1 stock move shifts delta by ' + Math.abs(g.gamma).toFixed(3) + '.'],
    ['Vega', f(g.vega, 2), g.vega == null ? 'Not reported' : 'If implied volatility rises 1 point, the position gains about ' + m(g.vega) + '.']
  ];
  return '<div class="greeks num">' + cards.map(function (c) { return '<div class="greek"><div class="g"><b>' + c[0] + '</b><span>' + esc(c[1]) + '</span></div><p>' + esc(c[2]) + '</p></div>'; }).join('') + '</div>' +
    (g.iv != null ? '<p class="note">Implied volatility ' + (g.iv * (g.iv < 5 ? 100 : 1)).toFixed(1) + '%' + (g.asOf ? ' · as of ' + esc(U.stamp(g.asOf)) : '') + '</p>' : '');
};

/* Shared trade-detail modal (paper + live). t = numbers, n = note from data/trade_notes.json, base = path prefix for images. */
window.PPTrade = (function () {
  var U = window.PP, esc = U.esc;
  var KIND = { news: ['news', 'News-driven'], chart: ['chart', 'Chart setup, no news'], earnings: ['earnings', 'Earnings bet'], override: ['', 'Pedro’s call'], test: ['', 'Order test'] };
  function parse(c) {
    var m = /^(\S+)\s+(\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2})\s+([\d.]+)([CP])$/i.exec(c || '');
    if (!m) return null;
    var exp = m[2].indexOf('-') > 0 ? U.dShort(m[2]) : (function (x) { var a = x.split('/'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+a[0] - 1] + ' ' + (+a[1]); })(m[2]);
    return { tk: m[1], exp: exp, k: +m[3], type: m[4].toUpperCase() === 'C' ? 'call' : 'put' };
  }
  function name(contracts) {
    var ps = contracts.map(parse);
    if (ps.length === 2 && ps[0] && ps[1] && ps[0].k === ps[1].k) return ps[0].tk + ' $' + ps[0].k.toLocaleString('en-US') + ' straddle';
    if (ps[0]) return ps[0].tk + ' $' + ps[0].k.toLocaleString('en-US') + ' ' + ps[0].type;
    return contracts.join(' + ');
  }
  function expiry(contracts) { var p = parse(contracts[0]); return p ? p.exp : ''; }
  function bullets(arr, kind, empty) { return arr && arr.length ? '<ul class="bul ' + kind + '">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="nl">' + (empty || 'Not logged') + '</p>'; }
  function held(a, b) {
    var x = new Date(a + ':00Z'), y = new Date(b + ':00Z'); if (isNaN(x) || isNaN(y)) return '';
    var m = Math.round((y - x) / 60000); if (m < 1) return 'under a minute'; if (m < 60) return m + ' min';
    var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? d + (d === 1 ? ' day ' : ' days ') + h + 'h' : h + 'h ' + mm + 'm';
  }
  function when(at) { var w = U.wall(at || ''); return w.d ? U.dShort(w.d) + (w.t ? ', ' + U.time12(w.t) : '') : ''; }

  function render(t, n, base) {
    n = n || {}; base = base || '';
    var res = t.res, word = res === 'win' ? 'Win' : res === 'loss' ? 'Loss' : res === 'open' ? 'Open' : 'Flat';
    var nm = name(t.contracts), exp = expiry(t.contracts);
    var head = '<h3 id="sheetTitle">' + esc(nm) + (t.qty > 1 ? ' <span class="flat" style="font-weight:500">×' + t.qty + '</span>' : '') + '</h3>' +
      '<div class="s"><span class="wl ' + res + '">' + word + '</span> · ' + esc(n.setup || 'Setup not logged') + ' · ' + esc(U.dLong(t.entryDate)) + '</div>';
    var en = n.entryAt || (t.entryDate + 'T' + (t.entryTime || '')), ex = n.exitAt || '';
    var hd = ex ? held(en, ex) : '';
    var body = '<div class="t-top"><div><div class="big num ' + U.cls(t.realized) + '" style="font-size:36px">' + U.smoney(t.realized) + '</div>' +
      '<div class="delta num"><span class="' + U.cls(t.pct) + '">' + U.pct(t.pct) + '</span><span class="lbl">on ' + U.money(t.cost, 0) + ' paid</span></div></div>' +
      (n.grade && n.grade !== 'n/a' ? '<div style="text-align:center"><span class="grade">' + esc(n.grade) + '</span><div class="note" style="margin:4px 0 0">Grade</div></div>' : '') + '</div>' +
      '<div class="strip num">' +
      '<div><div class="k">Contract</div><div class="v">' + esc(nm) + '</div><div class="s">' + (t.qty > 1 ? t.qty + ' contracts' : '1 contract') + (exp ? ' · expires ' + esc(exp) : '') + '</div></div>' +
      '<div><div class="k">Bought at</div><div class="v">' + U.price(t.entryPx) + '</div><div class="s">' + esc(when(en)) + '</div></div>' +
      '<div><div class="k">Sold at</div><div class="v">' + (t.exitPx != null ? U.price(t.exitPx) : '–') + '</div><div class="s">' + (ex ? esc(when(ex)) : 'Time not logged') + '</div></div>' +
      '<div><div class="k">Held for</div><div class="v">' + (hd || '–') + '</div><div class="s">' + (t.contracts.length > 1 ? 'call + put, priced together' : 'price is per share; ×100 per contract') + '</div></div></div>' +
      (n.plain_outcome ? '<div class="t-out ' + res + '">' + esc(n.plain_outcome) + '</div>' : '');
    /* charts: before / during / after */
    var ch = n.charts || { during: n.chart || null };
    body += '<h4>Charts</h4><div class="seg shots-tabs" role="tablist" aria-label="Chart timing" id="shotSeg">' +
      ['before', 'during', 'after'].map(function (k) { return '<button type="button" role="tab" data-v="' + k + '" aria-pressed="' + (k === 'during') + '">' + { before: 'Before', during: 'During the trade', after: 'After' }[k] + '</button>'; }).join('') + '</div><div id="shotBox"></div>';
    var kind = KIND[n.why_type] || null;
    body += '<h4>Why we entered</h4>' + (kind ? '<span class="kind ' + kind[0] + '">' + esc(kind[1]) + '</span>' : '') + U.nl(n.plain_why || n.why) +
      (n.why_check && n.why_check.text ? '<div class="callout ' + (n.why_check.level === 'explained' ? 'explained' : 'weak') + '"><b>' + (n.why_check.level === 'explained' ? 'How the news connects' : 'Reasoning was thin') + '</b>' + esc(n.why_check.text) + '</div>' : '');
    var wm = n.why_moved || {};
    body += '<h4>Why the stock moved that day</h4>' + (wm.summary ? '<p>' + esc(wm.summary) + '</p>' : '<p class="nl">No clear news found</p>') +
      (wm.sources && wm.sources.length ? '<ul class="srcs">' + wm.sources.map(function (s) { return '<li>' + (s.headline ? '<q>' + esc(s.headline) + '</q>' : esc(s.about || '')) + ' · ' + esc(s.source || '') + (s.when ? ' · ' + esc(s.when) : '') + '</li>'; }).join('') + '</ul>' : '');
    body += '<div class="plan-grid two" style="margin-top:28px"><div class="box"><h4>The plan</h4>' + U.nl(n.plain_plan || n.expected) + '</div>' +
      '<div class="box"><h4>What happened</h4>' + U.nl(n.plain_happened || n.happened) + '</div></div>';
    body += '<h4>What went right</h4>' + bullets(n.plain_right && n.plain_right.length ? n.plain_right : n.right, 'ok', 'Nothing logged') +
      '<h4>What went wrong</h4>' + bullets(n.plain_wrong && n.plain_wrong.length ? n.plain_wrong : n.wrong, 'bad', 'Nothing logged') +
      '<h4>Lesson</h4>' + U.nl(n.plain_lesson || n.lesson);
    if (t.fills && t.fills.length > 1) body += '<h4>Each part of the trade</h4><ul class="tl num">' + t.fills.map(function (r) {
      var p = parse(r.contract);
      return '<li><span class="ic b">' + (r.realized >= 0 ? '＋' : '−') + '</span><span><span class="t" style="display:block">' + esc(p ? p.tk + ' $' + p.k + ' ' + p.type : r.contract) + ' ×' + r.qty + '</span><span class="s">Bought ' + U.price(r.entry) + ', sold ' + U.price(r.exit) + '</span></span><span class="a ' + U.cls(r.realized) + '">' + U.smoney(r.realized, 0) + '</span></li>';
    }).join('') + '</ul>';
    function after(root) {
      function show(k) {
        var src = ch[k], box = root.querySelector('#shotBox');
        var label = { before: 'before the trade', during: 'during the trade', after: 'after the trade' }[k];
        box.innerHTML = src ? '<a href="' + esc(base + src) + '" target="_blank" rel="noopener" class="fade-swap" style="display:block"><img class="chart-img" src="' + esc(base + src) + '" alt="' + esc(nm) + ' chart ' + label + '" loading="lazy"></a>' +
          (k === 'during' ? '<p class="note">5-minute candles with where we bought, sold, and the stop and target lines.</p>' : '')
          : '<div class="shot-empty fade-swap"><div><b>No chart ' + label + ' yet</b>' + (k === 'before' ? 'Future trades will save the setup chart from before we buy.' : k === 'after' ? 'Future trades will save how the stock moved after we sold.' : 'No chart saved for this trade.') + '</div></div>';
      }
      var seg = root.querySelector('#shotSeg'); show('during');
      U.seg(seg, function (v) { show(v); });
    }
    return { head: head, body: body, after: after };
  }
  return { render: render, name: name, parse: parse };
})();
