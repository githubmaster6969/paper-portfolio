"use strict";
const LABEL = {moneyline:"Moneyline",spread:"Spread",anytime_td:"Anytime TD",yardage:"Yardage props",receptions:"Receptions props",
  sides_v1:"Sides v1",td_v1:"TD v1",props_v1:"Props v1",props_v2_calibrated:"Props v2 (calibrated)"};
const ORDER = {bet_type:["moneyline","spread","anytime_td","yardage","receptions"],
  model_version:["sides_v1","td_v1","props_v1","props_v2_calibrated"]};
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const lab = k => LABEL[k] || k || "Unknown";
const odds = o => o == null ? "—" : (o > 0 ? "+" + o : String(o));
const sgn = (n, d = 2) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(d);
const cls = n => n > 0 ? "pos" : n < 0 ? "neg" : "zero";
const isSettled = p => ["W","L","P"].includes(p.result);
const isGraded = p => isSettled(p) || p.result === "void";

function stats(list){
  const s = {n:list.length,W:0,L:0,P:0,V:0,pending:0,units:0,staked:0,clvN:0,clvSum:0,clvPos:0};
  for (const p of list){
    if (p.result === "W") s.W++; else if (p.result === "L") s.L++; else if (p.result === "P") s.P++;
    else if (p.result === "void") s.V++; else s.pending++;
    if (isSettled(p) && p.profit_units != null){ s.units += p.profit_units; s.staked += p.stake_units || 1; }
    if (p.clv != null){ s.clvN++; s.clvSum += p.clv; if (p.clv > 0) s.clvPos++; }
  }
  s.settled = s.W + s.L + s.P;
  s.roi = s.staked ? s.units / s.staked : null;
  s.clv = s.clvN ? s.clvSum / s.clvN : null;
  s.hit = (s.W + s.L) ? s.W / (s.W + s.L) : null;
  return s;
}
const rec = s => `${s.W}-${s.L}-${s.P}` + (s.V ? ` · ${s.V} void` : "");

function countUp(el, to, fmt){
  if (REDUCED || to === 0){ el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 900;
  const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function renderHero(all, s){
  const u = $("#units");
  if (!s.settled){ u.textContent = "0.00u"; u.classList.add("zero"); }
  else { u.className = "big tnum " + cls(s.units); countUp(u, s.units, v => sgn(v) + "u"); }
  $("#heroSub").innerHTML = s.settled
    ? `Record <b class="tnum">${rec(s)}</b> · ROI <b class="tnum ${cls(s.roi)}">${sgn(s.roi*100,1)}%</b>`
    : `No picks settled yet · <b class="tnum">${s.pending}</b> pending at flat 1u`;
  const chip = (k, v, c = "") => `<li><span class="k">${k}</span><span class="v tnum ${c}">${v}</span></li>`;
  $("#statChips").innerHTML =
    chip("Avg CLV", s.clv == null ? "—" : sgn(s.clv*100,1) + " pts", s.clv == null ? "zero" : cls(s.clv)) +
    chip("Hit rate", s.hit == null ? "—" : (s.hit*100).toFixed(0) + "%") +
    chip("Pending", String(s.pending));
  const weeks = [...new Set(all.map(p => p.week))].sort((a,b)=>a-b);
  $("#hdrMeta").textContent = `Week ${weeks.join(", ")} · ${all.length} picks`;
}

function renderChart(all){
  const pts = all.filter(p => isSettled(p) && p.profit_units != null)
    .sort((a,b) => (a.date+(a.captured_at||"")).localeCompare(b.date+(b.captured_at||"")));
  const el = $("#chart");
  if (!pts.length){
    $("#chartNote").textContent = "";
    el.innerHTML = `<div class="empty" role="img" aria-label="Chart empty: no settled picks yet"><b>Waiting on first results</b>
      <span>The line starts once the first pick is graded. Nothing here is projected.</span></div>`;
    return;
  }
  let c = 0; const ys = [0, ...pts.map(p => (c += p.profit_units))];
  const W = 360, H = 160, pad = 8, min = Math.min(0, ...ys), max = Math.max(0, ...ys), rng = (max - min) || 1;
  const x = i => pad + i * (W - 2*pad) / Math.max(1, ys.length - 1), y = v => pad + (max - v) * (H - 2*pad) / rng;
  const d = ys.map((v,i) => `${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = ys[ys.length-1], col = last >= 0 ? "var(--green)" : "var(--red)";
  $("#chartNote").textContent = `${pts.length} settled`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative units after ${pts.length} settled picks: ${sgn(last)} units">
    <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" stroke-dasharray="4 4"/>
    <path d="${d} L${x(ys.length-1)},${y(0)} L${x(0)},${y(0)}Z" fill="${col}" opacity=".08"/>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(ys.length-1)}" cy="${y(last)}" r="4" fill="${col}"/></svg>`;
}

function renderBreakdown(all, key){
  const groups = {};
  for (const p of all) (groups[p[key] || "unknown"] ||= []).push(p);
  const keys = [...ORDER[key].filter(k => groups[k]), ...Object.keys(groups).filter(k => !ORDER[key].includes(k))];
  const rows = keys.map(k => [k, stats(groups[k])]);
  const maxRoi = Math.max(0.01, ...rows.map(([,s]) => Math.abs(s.roi || 0)));
  $("#breakdown").innerHTML = rows.map(([k, s]) => {
    const right = s.settled ? `<span class="${cls(s.units)}">${sgn(s.units)}u</span>` : `<span class="zero">Pending</span>`;
    const metaR = s.settled ? `ROI ${sgn(s.roi*100,1)}%` : `${s.pending} open`;
    const clv = s.clv == null ? "CLV —" : `CLV ${sgn(s.clv*100,1)} pts`;
    let bar;
    if (s.settled){ const w = Math.abs(s.roi)/maxRoi*50;
      bar = `<i style="left:${s.roi>=0?50:50-w}%;width:${w}%;background:${s.roi>=0?"var(--green)":"var(--red)"}"></i>`; }
    else bar = `<i style="left:0;width:100%;background:repeating-linear-gradient(90deg,#D9D5CC 0 6px,transparent 6px 10px)"></i>`;
    return `<li><span class="nm">${esc(lab(k))}</span><span class="rt tnum">${right}</span>
      <span class="meta tnum">${s.n} picks · ${rec(s)}</span><span class="meta r tnum">${metaR} · ${clv}</span>
      <span class="bar" aria-hidden="true">${bar}</span></li>`;
  }).join("");
}

let FILTER = "all";
function renderFilters(all){
  const c = k => all.filter(FILTERS[k]).length;
  const btKeys = ORDER.bet_type.filter(k => all.some(p => p.bet_type === k));
  const keys = ["all","pending","settled",...btKeys];
  $("#filters").innerHTML = keys.filter(k => k !== "settled" || c(k)).map(k =>
    `<button class="chip" aria-pressed="${k===FILTER}" data-f="${k}">${esc(FLABEL[k] || lab(k))}<span class="n tnum">${c(k)}</span></button>`).join("");
}
const FLABEL = {all:"All",pending:"Pending",settled:"Settled"};
const FILTERS = new Proxy({all:()=>true, pending:p=>!isGraded(p), settled:isGraded}, {get:(t,k)=>t[k] || (p=>p.bet_type===k)});

function renderPicks(all){
  const list = all.filter(FILTERS[FILTER]);
  $("#pickCount").textContent = `${list.length} shown`;
  if (!list.length){ $("#picks").innerHTML = `<div class="empty"><b>No picks here</b><span>Try another filter.</span></div>`; return; }
  const kt = t => { const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t||""); if(!m) return 9999; let h=+m[1]%12; if(/pm/i.test(m[3])) h+=12; return h*60+ +m[2]; };
  const byDay = {};
  for (const p of list) (byDay[p.date] ||= []).push(p);
  $("#picks").innerHTML = Object.keys(byDay).sort().reverse().map(day => {
    const dl = new Date(day + "T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
    const slots = {};
    for (const p of byDay[day]) (slots[p.kickoff_et || "TBD"] ||= []).push(p);
    const ds = stats(byDay[day]);
    return `<section class="day" aria-label="${esc(dl)}"><h3>${esc(dl)} · Week ${byDay[day][0].week} <span class="tnum">· ${ds.settled ? rec(ds) : ds.pending + " pending"}</span></h3>` +
      Object.keys(slots).sort((a,b)=>kt(a)-kt(b)).map(slot => `<p class="slot">${esc(slot)} ET</p>` + slots[slot].map(card).join("")).join("") + `</section>`;
  }).join("");
}
function card(p){
  const st = p.result || "pending", pillTxt = {W:"Win",L:"Loss",P:"Push",void:"Void",pending:"Pending"}[st] || st;
  const pu = p.profit_units == null ? "—" : `<span class="${cls(p.profit_units)}">${sgn(p.profit_units)}u</span>`;
  const clv = p.clv == null ? "—" : `<span class="${cls(p.clv)}">${sgn(p.clv*100,1)}</span>`;
  return `<article class="pk"><div class="pk-top"><span class="pk-pick">${esc(p.pick)}</span>
    <span class="pill ${esc(st)}">${pillTxt}</span><span class="pk-game">${esc(p.game)} · ${esc(lab(p.bet_type))}</span></div>
    <div class="pk-ft tnum"><div><span class="k">Taken</span><span class="v">${odds(p.odds_american)}</span></div>
    <div><span class="k">Close</span><span class="v">${odds(p.closing_odds)}</span></div>
    <div><span class="k">CLV pts</span><span class="v">${clv}</span></div>
    <div><span class="k">Units</span><span class="v">${pu}</span></div></div>
    <details><summary>Why this pick</summary><p class="why">${esc(p.reason)}</p>
    <div class="tags tnum"><span class="tag">${esc(lab(p.model_version))}</span>
    <span class="tag">Edge ${sgn((p.edge||0)*100,1)} pts</span><span class="tag">Model ${((p.model_prob||0)*100).toFixed(0)}% vs ${((p.implied_prob||0)*100).toFixed(0)}% implied</span>
    <span class="tag">Conf ${p.confidence ?? "—"}/3</span><span class="tag">${esc(p.odds_source)}</span></div></details></article>`;
}

async function main(){
  let data;
  try { data = await (await fetch("data.json", {cache:"no-store"})).json(); }
  catch (e){ $("#main").innerHTML = `<div class="empty"><b>Couldn't load picks</b><span>data.json is missing or invalid.</span></div>`; return; }
  const all = data.picks || [];
  const s = stats(all);
  renderHero(all, s); renderChart(all);
  let key = "bet_type"; renderBreakdown(all, key);
  const seg = $("#seg"), btns = [...seg.querySelectorAll("button")];
  const pick = (i, focus) => { btns.forEach((b,j)=>{b.setAttribute("aria-checked", j===i); b.tabIndex = j===i?0:-1;});
    seg.dataset.i = i; renderBreakdown(all, btns[i].dataset.k); if (focus) btns[i].focus(); };
  btns.forEach((b,i) => { b.tabIndex = i?-1:0; b.addEventListener("click", () => pick(i));
    b.addEventListener("keydown", e => { if (/Arrow(Left|Right|Up|Down)/.test(e.key)){ e.preventDefault(); pick(1-i, true);} }); });
  renderFilters(all); renderPicks(all);
  $("#filters").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return;
    FILTER = b.dataset.f; renderFilters(all); renderPicks(all); $(`.chip[data-f="${FILTER}"]`)?.focus(); });
  const g = new Date(data.generated_at);
  $("#foot").textContent = `Paper bets · flat 1u · CLV = implied(close) − implied(taken), in probability points · data synced ${g.toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} ET`;
}
main();
