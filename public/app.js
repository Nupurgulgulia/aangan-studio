// Aangan Enquiry Desk: login, my leads, needs attention, call records, calendars. Designers log in, plus one "chayya" login
// that opens the voice agent's test console.
// Plain JavaScript, no build step. Everything shown from the server goes through esc().
(() => {
'use strict';

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tel = (p) => String(p || '').replace(/[^\d+]/g, '');
const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

const ICONS = {
  phone: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  calendar: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  refresh: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  left: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  right: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  doc: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  queue: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

/* ---------- time (always India time) ---------- */
const IST = 'Asia/Kolkata';
const nb = (s) => s.replace(/[  ]/g, ' ');
const F_DAY = new Intl.DateTimeFormat('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short' });
const F_TIME = new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true });
const day = (d) => F_DAY.format(new Date(d));
const clock = (d) => nb(F_TIME.format(new Date(d))).toLowerCase();
const when = (d) => (d ? `${day(d)}, ${clock(d)}` : '');
const ist = (ms) => { const d = new Date(ms + 330 * MIN); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
const istMidnight = (ms) => { const p = ist(ms); return Date.UTC(p.y, p.m, p.d) - 330 * MIN; };
const hhmm = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`; };
const greeting = () => { const h = Math.floor(ist(Date.now()).min / 60); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
function span(ms) {
  const m = Math.max(1, Math.round(Math.abs(ms) / MIN));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}
// A deadline as a coloured chip: red once passed, amber inside two hours.
function due(deadline, now = Date.now()) {
  if (!deadline) return '';
  const left = Date.parse(deadline) - now;
  const cls = left < 0 ? 'b-err' : left < 2 * HOUR ? 'b-warn' : 'b-info';
  return `<span class="b ${cls}">${left < 0 ? span(left) + ' overdue' : span(left) + ' left'}</span>`;
}
const ago = (d) => `${span(Date.now() - Date.parse(d))} ago`;

/* ---------- labels ---------- */
const STATUS = { new: 'New', accepted: 'Accepted', called: 'Called', held: 'Consultation held', proposal: 'Proposal sent', won: 'Won', lost: 'Lost', not_a_fit: 'Not a fit', done: 'Done' };
const PATH = ['new', 'accepted', 'called', 'held', 'proposal', 'won'];
const CLOSED = ['won', 'lost', 'not_a_fit', 'done'];
const NEXT = { new: ['accepted', 'Accept lead'], accepted: ['called', 'Mark called'], called: ['held', 'Consultation held'], held: ['proposal', 'Proposal sent'], proposal: ['won', 'Mark won'] };
const OUTCOME = { qualified: ['Qualified', 'b-ok'], declined: ['Declined', 'b-err'], escalated: ['Escalated', 'b-warn'], missed: ['Missed call', ''], info_only: ['Info only', ''] };
const TIER = { hot: ['Hot', 'b-err'], priority: ['Priority', 'b-warn'], standard: ['Standard', ''] };
const KIND = { consultation: 'Consultation', site_visit: 'Site visit', design_review: 'Design review', client_meeting: 'Client meeting', vendor: 'Showroom visit', measurement: 'Measurement', handover: 'Handover' };
const kindBadge = (k) => `<span class="b kc-${k}">${esc(KIND[k] || k)}</span>`;
const STAGES = ['design', 'approvals', 'execution', 'finishing', 'handover'];
const STAGE_LABEL = { design: 'Design', approvals: 'Approvals', execution: 'Execution', finishing: 'Finishing', handover: 'Handover' };
const range = (a, b) => `${clock(a)} – ${clock(b)}`;
const lakh = (v) => `₹${Number(v).toFixed(Number(v) % 1 ? 1 : 0)} lakh`;
const dayLabel = (ms) => { const t = istMidnight(Date.now()), d = istMidnight(ms); return d === t ? 'Today' : d === t + DAY ? 'Tomorrow' : d === t - DAY ? 'Yesterday' : day(ms); };
const badge = (text, cls = '') => `<span class="b ${cls}">${esc(text)}</span>`;
const outcomeBadge = (o) => (OUTCOME[o] ? badge(OUTCOME[o][0], OUTCOME[o][1]) : '');
const tierBadge = (t) => (TIER[t] ? badge(TIER[t][0], TIER[t][1]) : '');
const statusBadge = (s) => badge(STATUS[s] || s, CLOSED.includes(s) ? (s === 'won' ? 'b-ok' : '') : 'b-info');

/* ---------- state, api, toast ---------- */
const S = { me: null, current: null, route: null, cal: null, rtab: 'details', ptab: 'overview', timer: null, callTab: 'leads' };

async function api(path, body, { quiet = false, method } = {}) {
  const res = await fetch(`/api/${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* not json */ }
  if (res.status === 401 && !quiet) { S.me = null; showLogin('Your session ended. Please log in again.'); }
  if (res.status === 403 && data.error === 'password_change_required') showChange(true);
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status });
  return data;
}
function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${ic(kind === 'ok' ? 'check' : 'warning')}<span>${esc(msg)}</span>`;
  $('#toast').append(el);
  setTimeout(() => el.remove(), 4500);
}
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

/* ---------- login and password ---------- */
function resetState() {
  S.cal = null; S.callData = null; S.rtab = 'details'; S.route = null;
}
function showLogin(message) {
  stopTimer();
  resetState();
  $('#app').innerHTML = `<div class="auth"><form class="auth-card" id="login-form">
    <div class="logo">A</div><h1>Aangan Enquiry Desk</h1><div class="sub">Log in with your own account</div>
    ${message ? `<div class="err-msg" role="alert">${esc(message)}</div>` : ''}
    <label class="lbl" for="u">Username</label>
    <input class="field" id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(lsGet('aangan_user'))}" required>
    <label class="lbl" for="p">Password</label>
    <input class="field" id="p" name="password" type="password" autocomplete="current-password" required>
    <div id="login-err"></div>
    <button class="btn brand" type="submit">Log in</button>
    <div class="foot">Forgot your password? Ask the studio admin to reset it.</div>
  </form></div>`;
  ($('#u').value ? $('#p') : $('#u')).focus();
}

function passwordFields(forced) {
  return `
    <label class="lbl" for="cp">${forced ? 'One-time password you were given' : 'Current password'}</label>
    <input class="field" id="cp" type="password" autocomplete="current-password" required>
    <label class="lbl" for="np">New password</label>
    <input class="field" id="np" type="password" autocomplete="new-password" required>
    <label class="lbl" for="np2">Type the new password again</label>
    <input class="field" id="np2" type="password" autocomplete="new-password" required>
    <ul class="rules"><li>At least 10 characters</li><li>At least one letter and one number</li><li>Not your username</li></ul>
    <div id="pw-err"></div>`;
}
function showChange(forced) {
  stopTimer();
  $('#app').innerHTML = `<div class="auth"><form class="auth-card" id="change-form" data-forced="1">
    <div class="logo">${ic('lock')}</div><h1>Choose your own password</h1>
    <div class="sub">${esc(S.me?.name || '')}, replace the one-time password before you start.</div>
    ${passwordFields(true)}
    <button class="btn brand" type="submit">Save and continue</button>
    <div class="foot"><a href="#" data-act="logout">Log out</a></div>
  </form></div>`;
  $('#cp').focus();
}
async function submitPassword(form) {
  const cur = $('#cp', form).value, n1 = $('#np', form).value, n2 = $('#np2', form).value;
  const err = $('#pw-err', form);
  if (n1 !== n2) { err.innerHTML = '<div class="err-msg">The two new passwords are not the same.</div>'; return false; }
  try {
    const r = await api('change-password', { current: cur, next: n1 });
    S.me = r.user;
    return true;
  } catch (e) { err.innerHTML = `<div class="err-msg">${esc(e.message)}</div>`; return false; }
}

/* ---------- shell ---------- */
function tabsFor() {
  if (S.me.role === 'chayya') return [['console', 'Voice agent', 'phone']];
  return [['leads', 'My leads', 'phone'], ['projects', 'My projects', 'home'], ['attention', 'Needs attention', 'warning'], ['calendar', 'Calendar', 'calendar']];
}
function showShell() {
  const me = S.me;
  $('#app').innerHTML = `<header class="gh">
      <div class="logo">A</div>
      <div class="app">Aangan Enquiry Desk<small>Phone enquiries</small></div>
      <div class="search"></div>
      <button class="avatar" id="avatar" aria-haspopup="true" aria-label="Account menu">${esc(initials(me.name))}</button>
    </header>
    <div class="menu hide" id="menu" role="menu">
      <div class="who"><div class="strong">${esc(me.name)}</div><div class="muted small">${me.role === 'chayya' ? 'Voice agent test login' : 'Designer'} · ${esc(me.username)}</div></div>
      <button data-act="chpw">${ic('lock')} Change password</button>
      <button data-act="logout">${ic('logout')} Log out</button>
    </div>
    <nav class="tabs" id="tabs" aria-label="Sections">${tabsFor().map(([k, l, i]) => `<a class="tab" data-tab="${k}" href="#/${k}">${ic(i)}${l}<span class="n hide" data-badge="${k}"></span></a>`).join('')}</nav>
    <main id="view"></main>`;
}
function markTab() {
  const name = S.route.name;
  const on = name === 'call' ? S.callTab : name === 'project' ? 'projects' : name;
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === on));
}
function setBadge(key, n) {
  const el = $(`[data-badge="${key}"]`);
  if (el) { el.textContent = n; el.classList.toggle('hide', !n); }
}

/* ---------- routing and refresh ---------- */
function parseHash() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  return { name: name || '', arg };
}
async function route() {
  if (!S.me || S.me.must_change) return;
  if (!$('#view')) showShell();
  const { name, arg } = parseHash();
  const fd = S.me.role === 'chayya';
  if (!(fd ? ['console', 'call'] : ['leads', 'projects', 'project', 'attention', 'call', 'calendar']).includes(name)) { location.hash = fd ? '#/console' : '#/leads'; return; }
  S.route = { name, arg };
  if (name === 'call') S.rtab = 'details';
  if (name === 'project') S.ptab = 'overview';
  markTab();
  const views = { console: vConsole, leads: vLeads, projects: vProjects, project: () => vProject(arg), attention: vAttention, call: () => vCall(arg), calendar: vCalendar };
  S.current = views[name];
  $('#view').innerHTML = '<div class="card"><div class="skel"></div><div class="skel" style="width:60%"></div><div class="skel" style="width:80%"></div></div>';
  window.scrollTo(0, 0);
  await run(false);
  badges();
  startTimer();
}
async function run(quiet) {
  const token = S.route;
  try { await S.current(quiet); } catch (e) {
    if (token === S.route && e.status !== 401 && !quiet) $('#view').innerHTML = `<div class="banner err">${ic('warning')}<div class="grow">${esc(e.message)}</div><button class="btn sm" data-act="refresh">Try again</button></div>`;
  }
}
// The red counts on the tabs: calls to return, and my leads due within two hours.
async function badges() {
  if (S.me.role === 'chayya') return;
  try {
    const [q, l] = await Promise.all([api('queue', null, { quiet: true }), api('my-leads', null, { quiet: true })]);
    setBadge('attention', q.escalations.length + q.callbacks.length + q.declines.length);
    setBadge('leads', l.leads.filter((x) => ['new', 'accepted'].includes(x.status) && Date.parse(x.call_by) - Date.now() < 2 * HOUR).length);
  } catch (e) { /* the page itself reports errors */ }
}
function startTimer() {
  stopTimer();
  S.timer = setInterval(() => {
    if (document.hidden || $('.overlay') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    run(true); badges();
  }, S.me.role === 'chayya' ? 5000 : 20000);
}
function stopTimer() { clearInterval(S.timer); S.timer = null; }
const render = (html) => { const v = $('#view'); if (v) v.innerHTML = html; };

/* ---------- building blocks ---------- */
const pageHead = ({ icon, color, kicker, title, actions = '', extra = '' }) => `<div class="ph">
  <div class="oicon" style="background:${color}">${ic(icon)}</div>
  <div><div class="kicker">${kicker}</div><h1>${title}</h1></div><div class="actions">${actions}</div>${extra}</div>`;
const kpis = (list) => `<div class="kpis">${list.map(([l, v, c = '']) => `<div class="kpi ${c}"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>`;
const emptyState = (text) => `<div class="empty">${ic('check')}${esc(text)}</div>`;
const refreshBtn = `<span class="muted small" id="updated">Updated just now</span><button class="btn icon" data-act="refresh" aria-label="Refresh" title="Refresh">${ic('refresh')}</button>`;
function listCard(title, hint, rows, items, empty) {
  return `<section class="card"><div class="card-h"><h2>${title}</h2><span class="count ${rows.length ? '' : 'zero'}">${rows.length}</span><span class="hint right">${hint}</span></div>${rows.length ? items : emptyState(empty)}</section>`;
}
const callName = (c) => esc(c.caller_name || 'Unknown caller');
const phoneLink = (p) => (p ? `<a href="tel:${tel(p)}">${esc(p)}</a>` : '<span class="muted">no number</span>');

/* ---------- needs attention: what the bot could not finish alone ---------- */
async function vAttention() {
  const q = await api('queue');
  const now = Date.now();
  const esc15 = q.escalations.map((r) => ({ ...r, deadline: new Date(Date.parse(r.created_at) + 15 * MIN).toISOString() }));
  const total = q.escalations.length + q.callbacks.length + q.declines.length;
  setBadge('attention', total);
  render(`${pageHead({ icon: 'warning', color: '#ba0517', kicker: 'Shared by every designer · anyone can pick one up', title: 'Needs attention', actions: refreshBtn })}
    ${kpis([['Escalations to call back', q.escalations.length, q.escalations.length ? 'bad' : 'good'], ['Missed calls to return', q.callbacks.length, q.callbacks.length ? 'warn' : 'good'], ['Declined calls to check', q.declines.length, q.declines.length ? 'warn' : 'good']])}
    <div class="grid2">
      ${listCard('Escalations', 'Call back within 15 minutes', esc15, esc15.map((r) => `<div class="item click" data-act="open" data-id="${r.id}"><div class="grow"><div class="t">${callName(r)}</div><div class="m">${phoneLink(r.caller_phone)} · ${ago(r.created_at)}</div><div class="snip">${esc(r.summary || '')}</div></div><div class="side">${due(r.deadline, now)}<button class="btn sm brand" data-act="done" data-id="${r.id}">Called back</button></div></div>`).join(''), 'No one is waiting for a senior callback.')}
      ${listCard('Missed calls', 'Dropped or unanswered calls', q.callbacks, q.callbacks.map((r) => `<div class="item click" data-act="open" data-id="${r.id}"><div class="grow"><div class="t">${phoneLink(r.caller_phone)}</div><div class="m">Call came in ${ago(r.created_at)}</div></div><div class="side"><button class="btn sm brand" data-act="done" data-id="${r.id}">Called back</button></div></div>`).join(''), 'No missed calls to return.')}
    </div>
    <div style="height:12px"></div>
    ${listCard('Declined calls to check', 'A wrong decline loses a real lead. Read it, then confirm or reverse it', q.declines, q.declines.map((r) => `<div class="item click" data-act="open" data-id="${r.id}"><div class="grow"><div class="t">${callName(r)} <span class="m">${esc(r.area || '')}</span></div><div class="m">Reason: ${esc(r.decline_reason || 'not recorded')} · ${ago(r.created_at)}</div><div class="snip">${esc(r.summary || '')}</div></div><div class="side"><button class="btn sm danger" data-act="reverse" data-id="${r.id}" data-name="${esc(r.caller_name || 'this caller')}">Wrong, reverse</button><button class="btn sm" data-act="reviewed" data-id="${r.id}">Looks right</button></div></div>`).join(''), 'Every decline has been checked.')}`);
}

/* ---------- a single call ---------- */
async function vCall(id) {
  const d = await api(`call?id=${encodeURIComponent(id)}`);
  S.callData = d;
  S.callTab = S.me.role === 'chayya' ? 'console' : d.call.outcome === 'qualified' ? 'leads' : 'attention';
  markTab();
  drawCall();
}
function parseTranscript(text) {
  const lines = String(text).split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const m = /^\s*(agent|assistant|ai|bot|caller|user|customer)\s*[:\-]\s*(.*)$/i.exec(line);
    if (m) out.push({ who: /^(caller|user|customer)$/i.test(m[1]) ? 'caller' : 'agent', text: m[2] });
    else if (line.trim() && out.length) out[out.length - 1].text += `\n${line}`;
    else if (line.trim()) out.push({ who: 'agent', text: line });
  }
  return out;
}
function pathHtml(c) {
  const idx = PATH.indexOf(c.status);
  const closed = CLOSED.includes(c.status) && c.status !== 'won';
  return `<ol class="path ${closed ? 'closed' : ''}" aria-label="Lead status">${PATH.map((p, i) => `<li class="${!closed && i < idx ? 'done' : !closed && i === idx ? 'cur' : ''}"><button data-act="status" data-id="${c.id}" data-status="${p}" ${closed ? 'disabled' : ''}>${!closed && i < idx ? ic('check') : ''}${STATUS[p]}</button></li>`).join('')}</ol>`;
}
function drawCall() {
  const { call: c, events, messages = [], project = null } = S.callData;
  const now = Date.now();
  const back = `#/${S.callTab}`;
  const qualified = c.outcome === 'qualified';
  const open = !CLOSED.includes(c.status);
  const actions = S.me.role === 'chayya' ? `<a class="btn" href="${back}">${ic('back')} Back to the console</a>` : [
    `<a class="btn" href="${back}">${ic('back')} Back</a>`,
    project ? `<a class="btn" href="#/project/${project.id}">Open project</a>` : '',
    !project && qualified && c.status === 'won' ? `<button class="btn brand" data-act="make-project" data-id="${c.id}" data-name="${esc(c.caller_name || 'Customer')}">Start project</button>` : '',
    c.caller_phone ? `<a class="btn brand" href="tel:${tel(c.caller_phone)}">${ic('phone')} Call ${esc(c.caller_phone)}</a>` : '',
    qualified && open ? `<button class="btn" data-act="status" data-id="${c.id}" data-status="not_a_fit">Not a fit</button><button class="btn danger" data-act="status" data-id="${c.id}" data-status="lost">Mark lost</button>` : '',
    c.outcome === 'declined' ? `<button class="btn danger" data-act="reverse" data-id="${c.id}" data-name="${esc(c.caller_name || 'this caller')}">Wrong decline, reverse</button>${c.reviewed ? '' : `<button class="btn" data-act="reviewed" data-id="${c.id}">Looks right</button>`}` : '',
    ['escalated', 'missed'].includes(c.outcome) && c.status === 'new' ? `<button class="btn brand" data-act="done" data-id="${c.id}">Mark done</button>` : '',
  ].join('');
  const banner = c.outcome === 'declined'
    ? `<div class="banner warn">${ic('warning')}<div class="grow"><strong>The agent declined this call.</strong> Reason: ${esc(c.decline_reason || 'not recorded')}. Read the summary and transcript before agreeing: a wrongly declined lead is the costliest mistake.${c.reviewed ? ' <strong>Already checked.</strong>' : ''}</div></div>`
    : c.outcome === 'escalated' && c.status === 'new'
      ? `<div class="banner err">${ic('clock')}<div class="grow"><strong>Senior callback owed.</strong> The caller was promised a call within 15 minutes of ${clock(c.created_at)}. ${due(new Date(Date.parse(c.created_at) + 15 * MIN).toISOString(), now)}</div></div>`
      : c.outcome === 'qualified' && c.window_missed && open
        ? `<div class="banner warn">${ic('warning')}<div class="grow"><strong>No designer slot was free inside the call-by window.</strong> The earliest slot was booked instead. Call this lead as soon as you can.</div></div>`
        : '';
  const tabs = [['details', 'Details'], ['transcript', 'Transcript and recording'], ['activity', `Activity (${events.length + messages.length + 1})`]];
  let body;
  if (S.rtab === 'transcript') {
    const turns = c.transcript ? parseTranscript(c.transcript) : [];
    body = `${c.recording_url && /^https:\/\//i.test(c.recording_url) ? `<div style="margin-bottom:16px"><div class="l muted small">Recording${c.duration_sec ? ` · ${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : ''}</div><audio controls preload="none" src="${esc(c.recording_url)}"></audio></div>` : ''}
      ${turns.length ? `<div class="bubbles">${turns.map((t) => `<div class="bub ${t.who}"><div class="who">${t.who === 'caller' ? 'Caller' : 'Agent'}</div>${esc(t.text)}</div>`).join('')}</div>` : `<div class="banner info">${ic('doc')}<div class="grow">${c.recording_url ? 'No transcript has been attached to this call yet.' : 'The transcript and recording have not been attached to this call yet.'} The full conversation is always in Vaani under Conversations, History.</div><a class="btn sm" href="https://app.vaanivoice.ai/conversations/history" target="_blank" rel="noopener">Open Vaani history</a></div>`}`;
  } else if (S.rtab === 'activity') {
    const items = [
      ...events.map((e) => ({ ms: Date.parse(e.created_at), title: STATUS[e.status] || e.status.replace('_', ' '), meta: `${when(e.created_at)}${e.note ? ` · ${e.note}` : ''}` })),
      ...messages.map((m) => ({ ms: Date.parse(m.created_at), title: `Chayya → ${m.to_name || ''} · ${m.channel === 'whatsapp' ? 'WhatsApp' : m.channel === 'telegram' ? 'Telegram' : 'SMS'}${m.status === 'not_sent' ? ' · not sent yet' : ''}`, meta: when(m.created_at), quote: m.body })),
      { ms: Date.parse(c.created_at), title: 'Call received', meta: when(c.created_at) },
    ].sort((x, y) => y.ms - x.ms);
    body = `<ul class="timeline">${items.map((i) => `<li><div class="strong">${esc(i.title)}</div><div class="muted small">${esc(i.meta)}</div>${i.quote ? `<div class="quote">${esc(i.quote)}</div>` : ''}</li>`).join('')}</ul>`;
  } else {
    const f = (l, v, full) => `<div class="${full ? 'full' : ''}"><div class="l">${l}</div><div>${v ? esc(v) : '<span class="muted">Not given</span>'}</div></div>`;
    body = `<div class="dl">${f('Project', c.project_type)}${f('Size', c.size_sqft ? `${c.size_sqft} sq ft` : '')}${f('Area', c.area)}${f('Timeline', c.timeline_text)}${f('Decision-maker', c.decision_maker)}${f('Heard about us', c.source)}${f('Budget', c.budget_note)}${f('Why this urgency', c.tier_reasons)}${f('Summary for the designer', c.summary, true)}</div>`;
  }
  const highlights = `<div class="hl">
      <div><div class="l">Phone</div><div class="v">${phoneLink(c.caller_phone)}</div></div>
      <div><div class="l">Area</div><div class="v">${esc(c.area || '-')}</div></div>
      <div><div class="l">Project</div><div class="v">${esc(c.project_type || '-')}${c.size_sqft ? `, ${esc(c.size_sqft)} sq ft` : ''}</div></div>
      <div><div class="l">Designer</div><div class="v">${esc(c.designer || '-')}</div></div>
      ${qualified ? `<div><div class="l">Call by</div><div class="v">${when(c.call_by)} ${open ? due(c.call_by, now) : ''}</div></div><div><div class="l">Consultation</div><div class="v">${when(c.slot_start) || '-'}</div></div><div><div class="l">Status</div><div class="v">${statusBadge(c.status)}</div></div>` : ''}
    </div>`;
  render(`${pageHead({ icon: 'phone', color: '#0b827c', kicker: `Call · ${when(c.created_at)}`, title: `${callName(c)} ${outcomeBadge(c.outcome)} ${tierBadge(c.tier)}`, actions, extra: highlights })}
    ${qualified ? pathHtml(c) : ''}${banner}
    <div class="card"><div class="rtabs">${tabs.map(([k, l]) => `<button class="rtab ${S.rtab === k ? 'on' : ''}" data-act="rtab" data-t="${k}">${l}</button>`).join('')}</div><div class="card-b">${body}</div></div>`);
}

/* ---------- Chayya's test console: what the voice agent did on each call ---------- */
const SCRIPT = [
  ['English', 'Hello, I want to get my 3 BHK in Baner designed, design and execution. It is about 1450 square feet, new flat. We want to start in two months. My wife and I decide together and we will both attend. We saw you on Instagram. My name is Rohan Deshmukh and my number is 98765 43210.'],
  ['Hindi', 'नमस्ते, मुझे पुणे में अपने 2 बीएचके का इंटीरियर करवाना है। फ्लैट वाकड में है, करीब 1000 स्क्वेयर फीट। हम तीन महीने में शुरू करना चाहते हैं।'],
  ['Marathi', 'नमस्कार, मला पुण्यात माझ्या घराचे डिझाइन करायचे आहे. फ्लॅट हिंजवडीमध्ये आहे, साधारण बाराशे स्क्वेअर फूट. आम्हाला दोन महिन्यांत काम सुरू करायचे आहे.'],
  ['Should decline', 'Hi, I need a full interior for my flat in Nashik. (Outside Pune and Pimpri Chinchwad: she should politely decline.)'],
  ['Should escalate', 'I am an existing client and my designer has not replied for a week. I want to speak to someone senior. (She should take details and promise a callback.)'],
];
async function vConsole() {
  const d = await api('chayya');
  const all = S.showDemo === true;
  const calls = d.calls.filter((c) => all || !c.is_demo);
  const live = d.calls.filter((c) => !c.is_demo).length;
  const step = (ok, label, off) => `<span class="b ${ok ? 'b-ok' : ''}">${ok ? '&#10003; ' : '&ndash; '}${esc(ok ? label : off || label)}</span>`;
  const row = (c) => {
    const tg = c.messages.some((m) => m.channel === 'telegram' && m.status === 'sent');
    const wa = c.messages.some((m) => m.channel === 'whatsapp');
    const q = c.outcome === 'qualified';
    const steps = q
      ? `${step(Boolean(c.designer), `Assigned to ${c.designer}`, 'No designer')}${step(Boolean(c.slot_start), `Booked ${when(c.slot_start)}`, 'No slot booked')}${step(tg, 'Telegram sent', 'Telegram not sent')}${step(wa, 'WhatsApp draft saved', 'No WhatsApp draft')}${step(c.has_deal, 'HubSpot deal', 'No HubSpot deal')}`
      : '';
    return `<div class="item click" data-act="open" data-id="${c.id}"><div class="grow"><div class="t">${callName(c)} ${c.is_demo ? badge('Demo data') : badge('Test call', 'b-info')}</div>
      <div class="m">${esc(c.project_type || 'No project type')}${c.area ? ` · ${esc(c.area)}` : ''} · ${ago(c.created_at)}${c.duration_sec ? ` · ${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : ''}</div>
      ${q ? `<div class="steps">${steps}</div>` : `<div class="snip">${esc(c.decline_reason || c.summary || '')}</div>`}</div>
      <div class="side">${outcomeBadge(c.outcome)}${tierBadge(c.tier)}</div></div>`;
  };
  render(`${pageHead({ icon: 'phone', color: '#0b827c', kicker: 'Voice agent console · testing login', title: 'Chayya, front desk', actions: refreshBtn })}
    ${kpis([['Calls in 24 hours (not demo)', d.counts.total], ['Booked with a designer', d.counts.booked, 'good'], ['Declined', d.counts.declined], ['Escalated', d.counts.escalated, d.counts.escalated ? 'warn' : ''], ['Next designer in rotation', esc(d.next_designer || '-')]])}
    <section class="card"><div class="card-h"><h2>Talk to Chayya</h2><span class="hint right">Runs on Vaani, results land here</span></div><div class="card-b">
      <div class="banner info" style="margin-bottom:12px">${ic('doc')}<div class="grow">Vaani does not yet let a website embed the call widget (Deploy, Website shows <em>Coming soon</em>), so the call itself opens in Vaani. Everything she does during the call, the booking, Telegram, WhatsApp draft and HubSpot deal, shows up in the list below within seconds.</div></div>
      <ol class="how"><li><a class="btn brand" href="${esc(d.agent.vaani_url)}" target="_blank" rel="noopener">${ic('phone')} Open the voice test in Vaani</a></li>
        <li>Press <strong>Start Test</strong>, choose <strong>Audio</strong>, then <strong>Start Web (RTC) Call</strong>. Use headphones in a quiet room.</li>
        <li>Say one of the lines below, or speak naturally. Answer her questions one at a time.</li>
        <li>Come back to this page. The call appears under <strong>Calls handled</strong>, with what she did after it.</li></ol>
      <div class="muted small" style="margin:8px 0 6px">Things to say</div>
      ${SCRIPT.map(([l, t]) => `<div class="say"><span class="b b-info">${esc(l)}</span><span>${esc(t)}</span></div>`).join('')}
    </div></section>
    <section class="card"><div class="card-h"><h2>Calls handled</h2><span class="count ${calls.length ? '' : 'zero'}">${calls.length}</span>
      <label class="hint right" style="cursor:pointer"><input type="checkbox" id="show-demo" ${all ? 'checked' : ''}> Include demo data</label></div>
      ${calls.length ? calls.map(row).join('') : emptyState(live ? 'No calls yet.' : 'No test calls yet. Make one above and it will appear here.')}</section>
    <section class="card"><div class="card-h"><h2>What she is connected to</h2></div><div class="card-b steps">
      ${step(true, 'Aangan database and calendars')}${step(d.system.telegram, 'Telegram to designers', 'Telegram not set up')}${step(d.system.hubspot, 'HubSpot deals', 'HubSpot not set up')}${step(false, '', 'WhatsApp not connected: messages are saved as drafts')}
      <div class="muted small" style="margin-top:10px">Transcripts and recordings of live calls stay in Vaani under Conversations, History until a Vaani API key is connected to this dashboard.</div></div></section>`);
  const t = $('#show-demo');
  if (t) t.onchange = () => { S.showDemo = t.checked; t.blur(); run(true); };
}

/* ---------- designer: my leads ---------- */
async function vLeads() {
  const [{ leads }, cal] = await Promise.all([api('my-leads'), api('calendar')]);
  const now = Date.now();
  const upcoming = cal.bookings.filter((b) => !b.busy && Date.parse(b.end_at) > now).slice(0, 6);
  const nextUp = `<section class="card"><div class="card-h"><h2>Next up</h2><span class="hint right">Your calendar, soonest first</span></div>${upcoming.length ? upcoming.map((e) => {
    const to = e.project_id ? `#/project/${e.project_id}` : e.call_row_id ? `#/call/${e.call_row_id}` : '';
    return `<div class="item ${to ? 'click' : ''}" ${to ? `data-act="goto" data-to="${to}"` : ''}><div class="when"><div class="strong">${dayLabel(Date.parse(e.start_at))}</div><div class="muted small">${esc(range(e.start_at, e.end_at))}</div></div><div class="grow"><div class="t">${esc(e.title)}</div><div class="m">${kindBadge(e.kind)} ${esc(e.location || '')}</div></div></div>`;
  }).join('') : emptyState('Nothing booked yet.')}</section>`;
  const needs = leads.filter((l) => ['new', 'accepted'].includes(l.status));
  const prog = leads.filter((l) => ['called', 'held', 'proposal'].includes(l.status));
  const closed = leads.filter((l) => CLOSED.includes(l.status));
  const callNow = needs.filter((l) => Date.parse(l.call_by) - now < 2 * HOUR).length;
  const week = leads.filter((l) => !CLOSED.includes(l.status) && l.slot_start && Date.parse(l.slot_start) >= now && Date.parse(l.slot_start) < now + 7 * DAY).length;
  setBadge('leads', callNow);
  const item = (l) => {
    const next = NEXT[l.status];
    const isOpen = !CLOSED.includes(l.status);
    return `<div class="item click" data-act="open" data-id="${l.id}"><span class="bar ${l.tier || ''}"></span><div class="grow">
      <div class="row wrap"><span class="t">${esc(l.caller_name || 'Unknown caller')}</span>${tierBadge(l.tier)}${statusBadge(l.status)}</div>
      <div class="m">${esc(l.area || '')}${l.project_type ? ` · ${esc(l.project_type)}` : ''}${l.size_sqft ? ` · ${esc(l.size_sqft)} sq ft` : ''}</div>
      ${isOpen ? `<div class="m" style="margin-top:4px">Call by ${when(l.call_by)} ${due(l.call_by, now)}${l.slot_start ? ` · Consultation ${when(l.slot_start)}` : ''}</div>` : ''}
      <div class="snip" style="margin-top:4px">${esc(l.summary || '')}</div></div>
      <div class="side">${l.caller_phone && isOpen ? `<a class="btn sm" href="tel:${tel(l.caller_phone)}">${ic('phone')} Call</a>` : ''}${next ? `<button class="btn sm brand" data-act="status" data-id="${l.id}" data-status="${next[0]}">${next[1]}</button>` : ''}</div></div>`;
  };
  const sec = (title, hint, rows, empty) => `<section class="card"><div class="card-h"><h2>${title}</h2><span class="count ${rows.length ? '' : 'zero'}" ${rows.length && title === 'In progress' ? 'style="background:var(--brand)"' : ''}>${rows.length}</span><span class="hint right">${hint}</span></div>${rows.length ? rows.map(item).join('') : emptyState(empty)}</section>`;
  render(`${pageHead({ icon: 'phone', color: '#f88962', kicker: `${day(now)} · My leads`, title: `${greeting()}, ${esc(S.me.name.split(' ')[0])}`, actions: refreshBtn })}
    ${kpis([['Call now', callNow, callNow ? 'bad' : 'good'], ['Waiting for a first call', needs.length], ['In progress', prog.length], ['Consultations this week', week], ['Won', leads.filter((l) => l.status === 'won').length, 'good']])}
    ${nextUp}
    ${sec('Needs a call', 'Soonest deadline first', needs, 'No new leads waiting. Nice work.')}
    ${sec('In progress', 'Called, consultation, proposal', prog, 'Nothing in progress.')}
    ${closed.length ? sec('Closed', 'Won, lost or not a fit', closed, '') : ''}`);
}

/* ---------- my projects ---------- */
async function vProjects() {
  const { projects, won_without_project: wins = [] } = await api('projects');
  const now = Date.now();
  const soon = projects.filter((p) => p.stage === 'handover' || (Date.parse(p.target_date) - now) / DAY <= 14).length;
  const total = projects.reduce((sum, p) => sum + Number(p.value_lakh || 0), 0);
  render(`${pageHead({ icon: 'home', color: '#0176d3', kicker: 'My projects', title: 'Ongoing projects', actions: refreshBtn })}
    ${kpis([['Ongoing projects', projects.length], ['In execution', projects.filter((p) => p.stage === 'execution').length], ['Finishing or handover', projects.filter((p) => ['finishing', 'handover'].includes(p.stage)).length], ['Due in 14 days', soon, soon ? 'warn' : 'good'], ['Value in progress', lakh(total)]])}
    ${wins.length ? `<section class="card"><div class="card-h"><h2>Won leads waiting for a project</h2><span class="count">${wins.length}</span><span class="hint right">Start the project to add designs, photos and visits</span></div>${wins.map((w) => `<div class="item"><div class="grow"><div class="t">${esc(w.caller_name || 'Customer')}</div><div class="m">${esc(w.area || '')} · ${esc(w.project_type || '')}${w.size_sqft ? ` · ${esc(w.size_sqft)} sq ft` : ''}</div></div><div class="side"><button class="btn sm brand" data-act="make-project" data-id="${w.id}" data-name="${esc(w.caller_name || 'Customer')}">Start project</button></div></div>`).join('')}</section>` : ''}
    ${projects.length ? `<div class="pgrid">${projects.map((p) => {
      const left = Math.ceil((Date.parse(p.target_date) - now) / (7 * DAY));
      return `<article class="pcard" data-act="goto" data-to="#/project/${p.id}"><img src="${esc(p.hero_photo || '/photos/building-12826230.jpg')}" alt="" loading="lazy"><div class="pbody">
        <div class="row wrap"><span class="strong">${esc(p.name)}</span><span class="b ${p.stage === 'handover' ? 'b-ok' : 'b-info'} right">${STAGE_LABEL[p.stage]}</span></div>
        <div class="m muted">${esc(p.customer_name)} · ${esc(p.area)}</div><div class="m muted">${esc(p.project_type)} · ${esc(p.size_sqft)} sq ft · ${lakh(p.value_lakh)}</div>
        <div class="progress" title="${p.progress_pct}% complete"><i style="width:${p.progress_pct}%"></i></div>
        <div class="row small muted"><span>${p.progress_pct}% complete</span><span class="right">${left <= 0 ? 'Due now' : `Target ${day(Date.parse(p.target_date))}`}</span></div>
        <div class="pnext small">${p.next_event ? `${ic('calendar')} <strong>${dayLabel(Date.parse(p.next_event.start_at))}, ${clock(p.next_event.start_at)}</strong> · ${esc(p.next_event.title.split(' · ')[0])}` : '<span class="muted">Nothing scheduled</span>'}</div></div></article>`;
    }).join('')}</div>` : emptyState('No ongoing projects.')}`);
}

async function vProject(id) {
  const d = await api(`project?id=${encodeURIComponent(id)}`);
  S.projectData = d;
  drawProject();
}
const DESIGN_STATUS = { approved: ['Approved', 'b-ok'], shared: ['Shared with customer', 'b-info'], draft: ['Draft', ''], revision: ['Revision requested', 'b-warn'] };
const KIND_LABEL = { layout: 'Floor plan', concept: 'Concept', material_board: 'Material board', elevation: 'Elevation' };
function drawProject() {
  const { project: p, designs, photos, events, messages } = S.projectData;
  const now = Date.now();
  const idx = STAGES.indexOf(p.stage);
  const upcoming = events.filter((e) => Date.parse(e.end_at) > now), recent = events.filter((e) => Date.parse(e.end_at) <= now).reverse().slice(0, 4);
  const tabs = [['overview', 'Overview'], ['designs', `Designs (${designs.length})`], ['photos', `Site photos (${photos.length})`], ['messages', `Messages (${messages.length})`]];
  const left = Math.ceil((Date.parse(p.target_date) - now) / (7 * DAY));
  const hl = `<div class="hl">
    <div><div class="l">Customer</div><div class="v">${esc(p.customer_name)}</div></div>
    <div><div class="l">Phone</div><div class="v">${phoneLink(p.customer_phone)}</div></div>
    <div><div class="l">Site</div><div class="v">${esc(p.site_address || p.area)}</div></div>
    <div><div class="l">Scope</div><div class="v">${esc(p.project_type)}, ${esc(p.size_sqft)} sq ft</div></div>
    <div><div class="l">Project value</div><div class="v">${lakh(p.value_lakh)}</div></div>
    <div><div class="l">Started</div><div class="v">${day(Date.parse(p.start_date))}</div></div>
    <div><div class="l">Target</div><div class="v">${day(Date.parse(p.target_date))} <span class="muted small">${left > 0 ? `(${left} wk)` : '(due now)'}</span></div></div>
    <div><div class="l">Progress</div><div class="v">${p.progress_pct}%<div class="progress"><i style="width:${p.progress_pct}%"></i></div></div></div></div>`;
  let body;
  if (S.ptab === 'designs') {
    const bar = `<div class="row" style="margin-bottom:12px"><button class="btn brand" data-act="up-design">${ic('doc')} Upload a design</button><span class="muted small">A plan, render, material board or PDF. Photos are shrunk automatically.</span></div>`;
    body = bar + (designs.length ? `<div class="gal">${designs.map((g, i) => {
      const [sl, sc] = DESIGN_STATUS[g.status] || [g.status, ''];
      return `<figure class="gcard" data-act="lightbox" data-i="${i}" data-set="designs">${g.image_path.startsWith('/api/file') ? `<button class="x" data-act="delete-item" data-type="design" data-id="${g.id}" aria-label="Delete this design" title="Delete">&times;</button>` : ''}${g.mime === 'application/pdf' ? `<div class="pdftile">${ic('doc')}<span>PDF</span></div>` : `<img class="${/\.svg$/.test(g.image_path) ? 'contain' : ''}" src="${esc(g.image_path)}" alt="${esc(g.title)}" loading="lazy">`}<figcaption><div class="strong">${esc(g.title)}</div><div class="small muted">${KIND_LABEL[g.kind] || g.kind} · v${g.version} · ${g.shared_on ? day(Date.parse(g.shared_on)) : ''}</div>${badge(sl, sc)}</figcaption></figure>`;
    }).join('')}</div>` : emptyState('No designs uploaded yet.'));
  } else if (S.ptab === 'photos') {
    const bar = `<div class="row" style="margin-bottom:12px"><button class="btn brand" data-act="up-photo">${ic('doc')} Add site photos</button><span class="muted small">On a phone this opens the camera or your gallery.</span></div>`;
    body = bar + (photos.length ? `<div class="gal">${photos.map((g, i) => `<figure class="gcard" data-act="lightbox" data-i="${i}" data-set="photos">${g.image_path.startsWith('/api/file') ? `<button class="x" data-act="delete-item" data-type="photo" data-id="${g.id}" aria-label="Delete this photo" title="Delete">&times;</button>` : ''}<img src="${esc(g.image_path)}" alt="${esc(g.caption)}" loading="lazy"><figcaption><div class="small">${esc(g.caption)}</div><div class="small muted">${g.taken_on ? day(Date.parse(g.taken_on)) : ''}</div></figcaption></figure>`).join('')}</div>` : emptyState('No site photos yet.'));
  } else if (S.ptab === 'messages') {
    body = messages.length ? `<div class="bubbles">${messages.map((m) => `<div class="bub ${m.channel === 'telegram' ? '' : 'caller'}"><div class="who">Chayya → ${esc(m.to_name || '')} · ${m.channel === 'whatsapp' ? 'WhatsApp' : m.channel === 'telegram' ? 'Telegram' : 'SMS'} · ${when(m.created_at)}</div>${esc(m.body)}</div>`).join('')}</div>` : emptyState('No messages yet.');
  } else {
    const row = (e) => `<div class="item"><div class="when"><div class="strong">${dayLabel(Date.parse(e.start_at))}</div><div class="muted small">${esc(range(e.start_at, e.end_at))}</div></div><div class="grow"><div class="t">${esc(e.title)}</div><div class="m">${kindBadge(e.kind)} ${esc(e.location || '')}</div></div></div>`;
    body = `${p.summary ? `<p style="margin-top:0"><strong>Brief:</strong> ${esc(p.summary)}</p>` : ''}
      <div class="row" style="margin:6px 0 0"><button class="btn" data-act="add-event">${ic('calendar')} Schedule a visit or meeting</button></div>
      <h3 class="sect">Coming up</h3><div class="flush">${upcoming.length ? upcoming.map(row).join('') : '<div class="muted small" style="padding:6px 0">Nothing scheduled. Add the next visit to the calendar.</div>'}</div>
      ${recent.length ? `<h3 class="sect">Recent</h3><div class="flush">${recent.map(row).join('')}</div>` : ''}`;
  }
  render(`${pageHead({ icon: 'home', color: '#0176d3', kicker: `Project · ${esc(p.code)}`, title: `${esc(p.name)} ${badge(STAGE_LABEL[p.stage], p.stage === 'handover' ? 'b-ok' : 'b-info')}`,
    actions: `<a class="btn" href="#/projects">${ic('back')} Back</a><button class="btn" data-act="edit-project">Update project</button>${p.customer_phone ? `<a class="btn brand" href="tel:${tel(p.customer_phone)}">${ic('phone')} Call ${esc(firstName(p.customer_name))}</a>` : ''}`, extra: hl })}
    <ol class="path" aria-label="Project stage">${STAGES.map((st, i) => `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"><button data-act="set-stage" data-stage="${st}" title="Move the project to ${STAGE_LABEL[st]}">${i < idx ? ic('check') : ''}${STAGE_LABEL[st]}</button></li>`).join('')}</ol>
    <div class="card"><div class="rtabs">${tabs.map(([k, l]) => `<button class="rtab ${S.ptab === k ? 'on' : ''}" data-act="ptab" data-t="${k}">${l}</button>`).join('')}</div><div class="card-b">${body}</div></div>`);
}
function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

function lightbox(items, i) {
  const el = document.createElement('div');
  el.className = 'overlay lb';
  const show = (k) => {
    const it = items[(k + items.length) % items.length]; el.dataset.k = (k + items.length) % items.length;
    el.innerHTML = `<figure><img src="${esc(it.src)}" alt="${esc(it.caption)}"><figcaption><div class="strong">${esc(it.caption)}</div><div class="small">${esc(it.meta || '')}</div></figcaption></figure>
      <button class="btn icon lb-x" data-lb="x" aria-label="Close">&times;</button><button class="btn icon lb-p" data-lb="p" aria-label="Previous">${ic('left')}</button><button class="btn icon lb-n" data-lb="n" aria-label="Next">${ic('right')}</button>`;
  };
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') show(Number(el.dataset.k) + 1); if (e.key === 'ArrowLeft') show(Number(el.dataset.k) - 1); };
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-lb]'); if (b?.dataset.lb === 'n') return show(Number(el.dataset.k) + 1); if (b?.dataset.lb === 'p') return show(Number(el.dataset.k) - 1); if (!e.target.closest('figure img') || b) close(); });
  document.addEventListener('keydown', onKey);
  show(i); document.body.append(el);
}

/* ---------- calendar ---------- */
async function vCalendar() {
  const data = await api('calendar');
  const today = istMidnight(Date.now());
  const c = S.cal || (S.cal = { mode: S.me.role === 'designer' ? 'week' : 'day', dayMs: today, designerId: S.me.designer_id || data.designers[0]?.id });
  c.data = data;
  if (!c.designerId) c.designerId = data.designers[0]?.id;
  drawCalendar();
}
function slotsFor(data, dayMs) {
  const wd = ist(dayMs + 12 * HOUR).wd;
  const h = data.hours[wd];
  if (!h) return null;
  const out = [];
  for (let m = h[0]; m < h[1]; m += data.slot_minutes) out.push({ min: m, ms: dayMs + m * MIN });
  return out;
}
function drawCalendar() {
  const c = S.cal, data = c.data;
  if (!data || S.route.name !== 'calendar') return;
  const now = Date.now(), today = istMidnight(now), slotMs = data.slot_minutes * MIN;
  c.dayMs = Math.min(Math.max(c.dayMs, today - DAY), today + 7 * DAY);
  // A two hour site visit is one block that spans four rows, so the rows it covers are left out of the grid.
  const book = new Map(), covered = new Set();
  for (const b of data.bookings) {
    const st = Date.parse(b.start_at), en = Date.parse(b.end_at);
    const span = Math.max(1, Math.round((en - st) / slotMs));
    book.set(`${b.designer_id}|${st}`, { ...b, span, st, en });
    for (let k = 1; k < span; k++) covered.add(`${b.designer_id}|${st + k * slotMs}`);
  }
  const cellFor = (designerId, start) => {
    const key = `${designerId}|${start}`;
    if (covered.has(key)) return '';
    const b = book.get(key);
    if (!b) return `<div class="slot ${start + slotMs < now ? 'past' : ''} ${start <= now && now < start + slotMs ? 'now' : ''}"></div>`;
    const span = b.span > 1 ? ` style="grid-row:span ${b.span}"` : '';
    if (b.busy) return `<div class="bk busy"${span}><div class="nm">Busy</div></div>`;
    const to = b.project_id ? `#/project/${b.project_id}` : b.call_row_id ? `#/call/${b.call_row_id}` : '';
    return `<div class="bk k-${b.kind} ${b.kind === 'consultation' ? b.tier || '' : ''}"${span} ${to ? `data-act="goto" data-to="${to}"` : ''} title="${esc(b.title)}"><div class="nm">${esc(b.title)}</div>${b.span > 1 ? `<div class="ar">${esc(range(b.st, b.en))}</div>` : ''}<div class="ar">${esc(b.location || b.area || '')}</div></div>`;
  };
  let grid = '', cols = 0, title = '';
  if (c.mode === 'day') {
    const slots = slotsFor(data, c.dayMs);
    title = `${day(c.dayMs + 6 * HOUR)}`;
    if (!slots) grid = '<div class="empty">The studio is closed on Sundays, so there are no slots.</div>';
    else {
      cols = data.designers.length;
      grid = `<div class="cal" style="grid-template-columns:76px repeat(${cols},minmax(132px,1fr))"><div class="hd tm corner"></div>${data.designers.map((d) => `<div class="hd ${d.id === S.me.designer_id ? 'me' : ''}">${esc(d.name)}${d.id === S.me.designer_id ? '&nbsp;(you)' : ''}</div>`).join('')}
        ${slots.map((sl) => `<div class="tm">${hhmm(sl.min)}</div>${data.designers.map((d) => cellFor(d.id, sl.ms)).join('')}`).join('')}</div>`;
    }
  } else {
    const wd = ist(c.dayMs + 12 * HOUR).wd;
    const monday = c.dayMs - ((wd + 6) % 7) * DAY;
    const days = [0, 1, 2, 3, 4, 5].map((i) => monday + i * DAY);
    const d = data.designers.find((x) => x.id === c.designerId) || data.designers[0];
    title = `${esc(d?.name || '')}, week of ${day(monday + 6 * HOUR)}`;
    const ref = slotsFor(data, days[0]) || [];
    cols = days.length;
    grid = `<div class="cal" style="grid-template-columns:76px repeat(${cols},minmax(132px,1fr))"><div class="hd tm corner"></div>${days.map((m) => `<div class="hd ${m === today ? 'me' : ''}">${day(m + 6 * HOUR)}</div>`).join('')}
      ${ref.map((sl) => `<div class="tm">${hhmm(sl.min)}</div>${days.map((m) => cellFor(d.id, m + sl.min * MIN)).join('')}`).join('')}</div>`;
  }
  const legend = ['consultation', 'site_visit', 'design_review', 'client_meeting', 'vendor', 'handover'].map((k) => `<span><i class="kc-${k}"></i>${KIND[k]}</span>`).join('');
  render(`${pageHead({ icon: 'calendar', color: '#e56798', kicker: 'Calendar', title: 'Designer calendars', actions: refreshBtn })}
    <div class="card"><div class="toolbar">
      <div class="row"><button class="btn icon" data-act="cal-prev" aria-label="Previous">${ic('left')}</button><button class="btn" data-act="cal-today">Today</button><button class="btn icon" data-act="cal-next" aria-label="Next">${ic('right')}</button></div>
      <strong>${title}</strong>
      <div class="chips"><button class="chip ${c.mode === 'day' ? 'on' : ''}" data-act="cal-mode" data-m="day">Day, all designers</button><button class="chip ${c.mode === 'week' ? 'on' : ''}" data-act="cal-mode" data-m="week">Week, one designer</button></div>
      ${c.mode === 'week' ? `<select class="field" id="cal-designer" aria-label="Designer">${data.designers.map((d) => `<option value="${d.id}" ${d.id === c.designerId ? 'selected' : ''}>${esc(d.name)}${d.id === S.me.designer_id ? ' (you)' : ''}</option>`).join('')}</select>` : ''}
      <div class="legend right">${legend}<span><i style="background:#ecebea"></i>Busy</span></div>
    </div>${grid}</div>
    <p class="muted small">Times are India time. New enquiries are booked into free 30 minute slots by Chayya, in rotation, and never on top of a visit or meeting. You see other designers only as busy. Showing yesterday and the next seven days.</p>`);
}

/* ---------- uploads ---------- */
const todayIST = () => new Date(Date.now() + 330 * MIN).toISOString().slice(0, 10);
const nextWorkingDay = () => { let t = Date.now() + DAY; while (ist(t).wd === 0) t += DAY; return new Date(t + 330 * MIN).toISOString().slice(0, 10); };
const selectHtml = (id, options, selected) => `<select class="field" id="${id}" style="width:100%">${options.map(([v, l]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const lbl = (text, html, id) => `<label class="lbl" ${id ? `for="${id}"` : ''}>${esc(text)}</label>${html}`;

// Phone photos are huge, so shrink to 1600 px and re-encode before sending. PDFs go as they are.
function readFileForUpload(file) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      if (file.size > 2.5 * 1024 * 1024) return reject(new Error(`${file.name} is over 2.5 MB. Shrink the PDF first.`));
      const r = new FileReader();
      r.onload = () => resolve({ data: String(r.result).split(',')[1], mime: 'application/pdf', name: file.name });
      r.onerror = () => reject(new Error('Could not read the file.'));
      return r.readAsDataURL(file);
    }
    if (!/^image\//.test(file.type)) return reject(new Error(`${file.name} is not an image.`));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ data: c.toDataURL('image/jpeg', 0.82).split(',')[1], mime: 'image/jpeg', name: file.name.replace(/\.\w+$/, '') + '.jpg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} could not be opened as an image.`)); };
    img.src = url;
  });
}
const reloadProject = () => run(true);
const STAGE_CAPTION = { site_check: 'Site check', civil: 'Civil work in progress', electrical: 'Electrical and plumbing work', ceiling: 'False ceiling work', tiling: 'Flooring and tiling', carpentry: 'Carpentry work', painting: 'Painting', finishing: 'Finishing work', handover: 'Handover', other: 'Site photo' };

/* ---------- modal ---------- */
function modal({ title, body, confirm, danger, onConfirm, hideCancel }) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header>${esc(title)}<button class="btn icon right" data-close aria-label="Close" style="border:0">&times;</button></header>
    <div class="body">${body}<div id="m-err"></div></div>
    <footer>${hideCancel ? '' : '<button class="btn" data-close>Cancel</button>'}${confirm ? `<button class="btn ${danger ? 'danger' : 'brand'}" data-ok>${esc(confirm)}</button>` : ''}</footer></div>`;
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', async (e) => {
    if (e.target === el || e.target.closest('[data-close]')) return close();
    if (e.target.closest('[data-ok]')) {
      const ok = e.target.closest('[data-ok]');
      ok.disabled = true;
      try { if (!onConfirm || (await onConfirm(el)) !== false) close(); } catch (err) { $('#m-err', el).innerHTML = `<div class="err-msg">${esc(err.message)}</div>`; }
      ok.disabled = false;
    }
  });
  document.addEventListener('keydown', onKey);
  document.body.append(el);
  const first = $('input,textarea', el); if (first) first.focus();
  return el;
}

/* ---------- actions ---------- */
const refreshNow = () => run(true);
async function guard(el, fn) {
  if (el) el.disabled = true;
  try { await fn(); } catch (e) { if (e.status !== 401) toast(e.message, 'err'); } finally { if (el && el.isConnected) el.disabled = false; }
}
const ACTIONS = {
  open: (el) => { location.hash = `#/call/${el.dataset.id}`; },
  goto: (el) => { location.hash = el.dataset.to; },
  ptab: (el) => { S.ptab = el.dataset.t; drawProject(); },
  lightbox: (el) => {
    const d = S.projectData;
    if (el.dataset.set === 'designs' && d.designs[Number(el.dataset.i)].mime === 'application/pdf') { window.open(d.designs[Number(el.dataset.i)].image_path, '_blank', 'noopener'); return; }
    const items = el.dataset.set === 'designs'
      ? d.designs.map((g) => ({ src: g.image_path, caption: g.title, meta: `${KIND_LABEL[g.kind] || g.kind} · version ${g.version} · ${(DESIGN_STATUS[g.status] || [g.status])[0]}` }))
      : d.photos.map((g) => ({ src: g.image_path, caption: g.caption, meta: g.taken_on ? day(Date.parse(g.taken_on)) : '' }));
    lightbox(items, Number(el.dataset.i));
  },
  refresh: () => run(true).then(() => { const u = $('#updated'); if (u) u.textContent = 'Updated just now'; }),
  logout: async () => { await api('logout', {}, { quiet: true }).catch(() => {}); S.me = null; showLogin(); },
  chpw: () => {
    $('#menu').classList.add('hide');
    modal({ title: 'Change password', body: passwordFields(false), confirm: 'Save password', onConfirm: async (m) => { const ok = await submitPassword(m); if (ok) toast('Password changed.'); return ok; } });
  },
  done: (el) => guard(el, async () => { await api('review', { id: Number(el.dataset.id), action: 'done' }); toast('Marked done.'); await refreshNow(); }),
  reviewed: (el) => guard(el, async () => { await api('review', { id: Number(el.dataset.id), action: 'reviewed' }); toast('Decline confirmed.'); await refreshNow(); }),
  reverse: (el) => {
    const id = Number(el.dataset.id), name = el.dataset.name;
    modal({
      title: 'Reverse this decline?',
      body: `<p style="margin-top:0">The agent declined <strong>${esc(name)}</strong>. This books them with the next designer in rotation and marks the lead <strong>Hot</strong>, so they are called within two working hours.</p>
        <label class="lbl" for="rv-note">Why was the decline wrong? (optional)</label><textarea class="field" id="rv-note" rows="3" maxlength="300" placeholder="For example: the caller was flexible on the date"></textarea>`,
      confirm: 'Reverse and book', danger: true,
      onConfirm: async (m) => {
        const r = await api('review', { id, action: 'reverse', note: $('#rv-note', m).value });
        toast(`Booked with ${r.designer}. Call by ${when(r.call_by)}.`);
        await refreshNow();
      },
    });
  },
  status: (el) => guard(el, async () => {
    const status = el.dataset.status;
    await api('set-status', { id: Number(el.dataset.id), status });
    toast(`Marked ${STATUS[status].toLowerCase()}.`);
    await refreshNow();
  }),
  rtab: (el) => { S.rtab = el.dataset.t; drawCall(); },
  'cal-prev': () => { S.cal.dayMs -= S.cal.mode === 'week' ? 7 * DAY : DAY; drawCalendar(); },
  'cal-next': () => { S.cal.dayMs += S.cal.mode === 'week' ? 7 * DAY : DAY; drawCalendar(); },
  'cal-today': () => { S.cal.dayMs = istMidnight(Date.now()); drawCalendar(); },
  'cal-mode': (el) => { S.cal.mode = el.dataset.m; drawCalendar(); },
  'set-stage': (el) => guard(el, async () => {
    const MIN_PROGRESS = { design: 5, approvals: 30, execution: 40, finishing: 80, handover: 92 };
    const p = S.projectData.project, stage = el.dataset.stage;
    await api('project-update', { id: p.id, stage, progress_pct: Math.max(p.progress_pct, MIN_PROGRESS[stage]) });
    toast(`Project moved to ${STAGE_LABEL[stage]}.`); await reloadProject();
  }),
  'edit-project': () => {
    const p = S.projectData.project;
    modal({ title: 'Update project', confirm: 'Save changes', body: `${lbl('Stage', selectHtml('ep-stage', STAGES.map((x) => [x, STAGE_LABEL[x]]), p.stage), 'ep-stage')}
      ${lbl('Progress, percent complete', `<input class="field" id="ep-progress" type="number" min="0" max="100" step="1" value="${p.progress_pct}" style="width:100%">`, 'ep-progress')}
      ${lbl('Target completion date', `<input class="field" id="ep-target" type="date" value="${esc(String(p.target_date || '').slice(0, 10))}" style="width:100%">`, 'ep-target')}
      ${lbl('Project value, lakh', `<input class="field" id="ep-value" type="number" min="0" step="0.1" value="${esc(p.value_lakh ?? '')}" style="width:100%">`, 'ep-value')}
      ${lbl('Brief and notes', `<textarea class="field" id="ep-summary" rows="4" maxlength="600">${esc(p.summary || '')}</textarea>`, 'ep-summary')}`,
    onConfirm: async (m) => {
      await api('project-update', { id: p.id, stage: $('#ep-stage', m).value, progress_pct: Number($('#ep-progress', m).value), target_date: $('#ep-target', m).value || undefined, value_lakh: Number($('#ep-value', m).value) || undefined, summary: $('#ep-summary', m).value });
      toast('Project updated.'); await reloadProject();
    } });
  },
  'make-project': (el) => {
    const id = Number(el.dataset.id), surname = el.dataset.name.split(/\s+/).pop();
    modal({ title: `Start a project for ${el.dataset.name}`, confirm: 'Create project', body: `<p style="margin-top:0" class="muted">The customer details come from the call Chayya took. You add the rest.</p>
      ${lbl('Project name', `<input class="field" id="np-name" value="${esc(surname)} residence" maxlength="100" style="width:100%">`, 'np-name')}
      ${lbl('Site address', '<input class="field" id="np-site" placeholder="Flat, wing, society, area" maxlength="200" style="width:100%">', 'np-site')}
      ${lbl('Project value, lakh', '<input class="field" id="np-value" type="number" min="0" step="0.1" placeholder="e.g. 12.5" style="width:100%">', 'np-value')}
      ${lbl('Start date', `<input class="field" id="np-start" type="date" value="${todayIST()}" style="width:100%">`, 'np-start')}
      ${lbl('Target completion date', '<input class="field" id="np-target" type="date" style="width:100%">', 'np-target')}`,
    onConfirm: async (m) => {
      const r = await api('project-create', { call_id: id, name: $('#np-name', m).value, site_address: $('#np-site', m).value, value_lakh: Number($('#np-value', m).value) || undefined, start_date: $('#np-start', m).value, target_date: $('#np-target', m).value || undefined });
      toast('Project created.'); location.hash = `#/project/${r.project_id}`;
    } });
  },
  'up-photo': () => {
    const p = S.projectData.project;
    const stages = [['site_check', 'Site check or measurement'], ['civil', 'Civil work'], ['electrical', 'Electrical and plumbing'], ['ceiling', 'False ceiling'], ['tiling', 'Flooring and tiling'], ['carpentry', 'Carpentry'], ['painting', 'Painting'], ['finishing', 'Finishing'], ['handover', 'Handover'], ['other', 'Other']];
    modal({ title: 'Add site photos', confirm: 'Upload', body: `${lbl('Photos', '<input class="field" id="up-files" type="file" accept="image/*" multiple style="width:100%;height:auto;padding:8px">', 'up-files')}
      ${lbl('Stage of work', selectHtml('up-stage', stages, 'civil'), 'up-stage')}
      ${lbl('Caption (optional, shared by all the photos)', '<input class="field" id="up-caption" maxlength="200" placeholder="e.g. Wiring done in the living room" style="width:100%">', 'up-caption')}
      ${lbl('Date taken', `<input class="field" id="up-date" type="date" value="${todayIST()}" style="width:100%">`, 'up-date')}`,
    onConfirm: async (m) => {
      const files = [...$('#up-files', m).files];
      if (!files.length) throw new Error('Choose at least one photo.');
      const status = $('#m-err', m);
      for (let i = 0; i < files.length; i++) {
        status.innerHTML = `<div class="banner info" style="margin:12px 0 0">Uploading ${i + 1} of ${files.length}…</div>`;
        const f = await readFileForUpload(files[i]);
        if (f.mime === 'application/pdf') throw new Error('Site photos must be images.');
        await api('project-photo', { project_id: p.id, caption: $('#up-caption', m).value || STAGE_CAPTION[$('#up-stage', m).value], stage: $('#up-stage', m).value, taken_on: $('#up-date', m).value, ...f });
      }
      toast(files.length === 1 ? 'Photo added.' : `${files.length} photos added.`); await reloadProject();
    } });
  },
  'up-design': () => {
    const p = S.projectData.project;
    modal({ title: 'Upload a design', confirm: 'Upload', body: `${lbl('File (image or PDF)', '<input class="field" id="ud-file" type="file" accept="image/*,application/pdf" style="width:100%;height:auto;padding:8px">', 'ud-file')}
      ${lbl('Title', '<input class="field" id="ud-title" maxlength="120" placeholder="e.g. Furnished floor plan" style="width:100%">', 'ud-title')}
      ${lbl('Type', selectHtml('ud-kind', [['layout', 'Floor plan'], ['concept', 'Concept or render'], ['material_board', 'Material board'], ['elevation', 'Elevation'], ['other', 'Other']], 'layout'), 'ud-kind')}
      ${lbl('Status', selectHtml('ud-status', [['draft', 'Draft'], ['shared', 'Shared with the customer'], ['approved', 'Approved'], ['revision', 'Revision requested']], 'draft'), 'ud-status')}
      <p class="muted small" style="margin-bottom:0">Uploading the same title again saves it as the next version.</p>`,
    onConfirm: async (m) => {
      const file = $('#ud-file', m).files[0];
      if (!file) throw new Error('Choose a file.');
      $('#m-err', m).innerHTML = '<div class="banner info" style="margin:12px 0 0">Uploading…</div>';
      const f = await readFileForUpload(file);
      await api('project-design', { project_id: p.id, title: $('#ud-title', m).value || file.name.replace(/\.\w+$/, ''), kind: $('#ud-kind', m).value, status: $('#ud-status', m).value, ...f });
      toast('Design uploaded.'); await reloadProject();
    } });
  },
  'add-event': () => {
    const p = S.projectData.project;
    const times = []; for (let m = 600; m <= 1110; m += 30) times.push([`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, hhmm(m)]);
    modal({ title: 'Schedule a visit or meeting', confirm: 'Add to calendar', body: `${lbl('What is it?', selectHtml('ev-kind', [['site_visit', 'Site visit'], ['design_review', 'Design review'], ['client_meeting', 'Client meeting'], ['vendor', 'Showroom visit'], ['measurement', 'Measurement'], ['handover', 'Handover']], 'site_visit'), 'ev-kind')}
      ${lbl('Date', `<input class="field" id="ev-date" type="date" value="${nextWorkingDay()}" style="width:100%">`, 'ev-date')}
      ${lbl('Start time', selectHtml('ev-start', times, '11:00'), 'ev-start')}
      ${lbl('Length', selectHtml('ev-len', [['30', '30 minutes'], ['60', '1 hour'], ['90', '1 hour 30 minutes'], ['120', '2 hours'], ['180', '3 hours'], ['240', '4 hours']], '120'), 'ev-len')}
      ${lbl('Where', `<input class="field" id="ev-where" maxlength="160" value="${esc(p.site_address || '')}" style="width:100%">`, 'ev-where')}`,
    onConfirm: async (m) => {
      await api('event-add', { project_id: p.id, kind: $('#ev-kind', m).value, date: $('#ev-date', m).value, start: $('#ev-start', m).value, duration_min: Number($('#ev-len', m).value), location: $('#ev-where', m).value });
      toast('Added to your calendar.'); await reloadProject();
    } });
  },
  'delete-item': (el) => {
    const type = el.dataset.type, id = Number(el.dataset.id);
    modal({ title: `Delete this ${type}?`, confirm: 'Delete', danger: true, body: '<p style="margin:0">It is removed from the project and cannot be brought back.</p>',
      onConfirm: async () => { await api('item-delete', { type, id }); toast('Deleted.'); await reloadProject(); } });
  },
  copy: async (el) => { try { await navigator.clipboard.writeText(el.dataset.text); toast('Copied.'); } catch (e) { toast('Copy it by hand.', 'err'); } },
};

/* ---------- wiring ---------- */
document.addEventListener('click', (e) => {
  const menu = $('#menu');
  if (menu && !e.target.closest('#menu') && !e.target.closest('#avatar')) menu.classList.add('hide');
  if (e.target.closest('#avatar')) { menu.classList.toggle('hide'); return; }
  if (e.target.closest('a[href]:not([href="#"])')) return;
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el);
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.id === 'login-form') {
    const btn = $('button', form); btn.disabled = true;
    try {
      const r = await api('login', { username: $('#u').value, password: $('#p').value }, { quiet: true });
      lsSet('aangan_user', r.user.username);
      S.me = r.user;
      if (S.me.must_change) showChange(true); else { showShell(); route(); }
    } catch (err) { $('#login-err').innerHTML = `<div class="err-msg" role="alert">${esc(err.message)}</div>`; btn.disabled = false; $('#p').select(); }
  } else if (form.id === 'change-form') {
    if (await submitPassword(form)) { toast('Password saved. Welcome.'); showShell(); route(); }
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'cal-designer') { S.cal.designerId = Number(e.target.value); drawCalendar(); }
});
window.addEventListener('hashchange', route);

(async function boot() {
  try { S.me = (await api('me', null, { quiet: true })).user; } catch (e) { S.me = null; }
  if (!S.me) return showLogin();
  if (S.me.must_change) return showChange(true);
  showShell();
  route();
})();
})();
