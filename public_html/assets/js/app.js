/* ==========================================================================
   DeliveryNextGen — live demo dashboard (/app/)
   A self-contained fleet simulation that runs in the browser:
   street graph + shortest-path routing, robots with battery, a delivery
   lifecycle (queued → assigned → en route → delivered), integrations and team.
   State is kept in localStorage on this device only. No network requests.
   CSP-safe: no inline styles or handlers; dynamic sizes are set via CSSOM.
   ========================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- i18n
  var T = JSON.parse(document.getElementById('app-i18n').textContent);
  var LANG = document.documentElement.lang || 'en';
  var STREETS = T.streets.split('\n');
  function t(k, v) {
    var s = T[k];
    if (s == null) return k;
    if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n] != null ? v[n] : m; });
    return s;
  }
  var NF = new Intl.NumberFormat(LANG);
  var NF1 = new Intl.NumberFormat(LANG, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var WD = new Intl.DateTimeFormat(LANG, { weekday: 'long' });

  // ---------------------------------------------------------------- utils
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function hhmm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
  function frag(html) { var tp = document.createElement('template'); tp.innerHTML = html.trim(); return tp.content.firstElementChild; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function icon(name) { return ICONS[name] || ''; }
  // Dynamic sizes without inline style attributes (CSP: style-src 'self').
  function applyDyn(root) {
    $$('[data-w]', root).forEach(function (el) { el.style.width = el.dataset.w + '%'; });
    $$('[data-cols]', root).forEach(function (el) { el.style.setProperty('--cols', el.dataset.cols); });
    if (root.dataset && root.dataset.w) root.style.width = root.dataset.w + '%';
  }

  var SVG_ATTR = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  var ICONS = {
    check: '<svg ' + SVG_ATTR + '><path d="m5 12 5 5 9-10"/></svg>',
    x: '<svg ' + SVG_ATTR + '><path d="m6 6 12 12M18 6 6 18"/></svg>',
    package: '<svg ' + SVG_ATTR + '><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>',
    route: '<svg ' + SVG_ATTR + '><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/></svg>',
    bolt: '<svg ' + SVG_ATTR + '><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
    batt: '<svg ' + SVG_ATTR + '><rect x="3" y="7" width="16" height="10" rx="2.5"/><path d="M21 10.5v3M6.5 10v4"/></svg>',
    plug: '<svg ' + SVG_ATTR + '><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/></svg>',
    code: '<svg ' + SVG_ATTR + '><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/></svg>',
    hook: '<svg ' + SVG_ATTR + '><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><circle cx="12" cy="6" r="2.5"/><path d="M10.6 8.2 7.4 14.8M13.4 8.2l3.2 6.6M8.5 17h7"/></svg>',
    cart: '<svg ' + SVG_ATTR + '><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2.5l2.2 11h10.6L20.5 7H7"/></svg>',
    store: '<svg ' + SVG_ATTR + '><path d="M4 9h16l-1.5-5h-13L4 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></svg>',
    sms: '<svg ' + SVG_ATTR + '><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 10h8M8 13h5"/></svg>',
    file: '<svg ' + SVG_ATTR + '><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
    map: '<svg ' + SVG_ATTR + '><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
    link: '<svg ' + SVG_ATTR + '><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    download: '<svg ' + SVG_ATTR + '><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    pause: '<svg ' + SVG_ATTR + '><path d="M9 6v12M15 6v12"/></svg>',
    play: '<svg ' + SVG_ATTR + '><path d="M8 5.5v13l10-6.5-10-6.5Z"/></svg>',
    user: '<svg ' + SVG_ATTR + '><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>'
  };

  // ---------------------------------------------------------------- constants
  var STORE_KEY = 'dng-demo-v1';
  var W = 600, H = 360;
  var BASE_PX = 16;         // robot speed on the map, px per real second at 1×
  var SIM_RATE = 12;        // sim seconds per real second at 1× (clock runs 12× faster)
  var PX_PER_SIM_S = BASE_PX / SIM_RATE;
  var DWELL_PICKUP = 45, DWELL_DROP = 60;   // sim seconds
  var DRAIN_PER_PX = 0.012, CHARGE_PER_S = 0.035;
  var MAX_ACTIVE = 9;
  var CURVE = [0, 0, 0, 0, 0, 0, 0, 4, 8, 12, 14, 22, 34, 30, 18, 14, 15, 20, 32, 36, 28, 16, 8, 3];
  var CHART_FROM = 7, CHART_TO = 23;

  // ---------------------------------------------------------------- street graph
  // Same old-town grid as the dashboard on the home page, scaled to 600×360.
  var STREET_GEO = [
    { y: 70, a: 0, b: W }, { y: 180, a: 0, b: W }, { y: 290, a: 0, b: W },
    { x: 90, a: 0, b: H }, { x: 230, a: 0, b: H }, { x: 380, a: 70, b: 290 }, { x: 500, a: 0, b: H }
  ];
  var NODES = {};
  function nid(x, y) { return x + ',' + y; }
  function addNode(x, y) { var id = nid(x, y); if (!NODES[id]) NODES[id] = { id: id, x: x, y: y, adj: [] }; return id; }
  var STREET_STOPS = STREET_GEO.map(function (s, i) {
    var stops = [];
    if (s.y != null) {
      stops.push(s.a, s.b);
      STREET_GEO.forEach(function (o) { if (o.x != null && s.y >= o.a && s.y <= o.b) stops.push(o.x); });
    } else {
      stops.push(s.a, s.b);
      STREET_GEO.forEach(function (o) { if (o.y != null && s.x >= o.a && s.x <= o.b) stops.push(o.y); });
    }
    stops = stops.filter(function (v, k, arr) { return arr.indexOf(v) === k; }).sort(function (p, q) { return p - q; });
    var ids = stops.map(function (v) { return s.y != null ? addNode(v, s.y) : addNode(s.x, v); });
    for (var k = 0; k < ids.length - 1; k++) {
      var A = NODES[ids[k]], B = NODES[ids[k + 1]], d = dist(A, B);
      A.adj.push({ id: B.id, d: d }); B.adj.push({ id: A.id, d: d });
    }
    return { i: i, stops: stops, ids: ids };
  });
  function nodeLoc(id) { var n = NODES[id]; return { x: n.x, y: n.y, n: id }; }

  // A point on street `s` at coordinate `c` (x for horizontal streets, y for vertical).
  function streetPoint(s, c) {
    var g = STREET_GEO[s], st = STREET_STOPS[s];
    c = clamp(c, g.a + 6, g.b - 6);
    for (var k = 0; k < st.stops.length; k++) {
      if (Math.abs(st.stops[k] - c) < 0.5) return nodeLoc(st.ids[k]);
    }
    for (k = 0; k < st.stops.length - 1; k++) {
      if (c > st.stops[k] && c < st.stops[k + 1]) {
        var p = g.y != null ? { x: c, y: g.y } : { x: g.x, y: c };
        p.e = [st.ids[k], st.ids[k + 1]];
        return p;
      }
    }
    return nodeLoc(st.ids[0]);
  }
  function addrLoc(s, no) {
    var g = STREET_GEO[s], len = g.b - g.a;
    var f = 0.04 + 0.92 * (((no - 1) % 60) / 59);
    var c = g.a + len * f;
    // keep doors off the crossings
    STREET_STOPS[s].stops.forEach(function (v) { if (Math.abs(v - c) < 9) c = v + (c >= v ? 11 : -11); });
    return streetPoint(s, Math.round(c));
  }
  var HUBS = [streetPoint(0, 160), streetPoint(6, 236)];
  var HUB_AXIS = ['x', 'y'];

  function ends(loc) {
    if (loc.n) return [{ id: loc.n, d: 0 }];
    return [{ id: loc.e[0], d: dist(loc, NODES[loc.e[0]]) }, { id: loc.e[1], d: dist(loc, NODES[loc.e[1]]) }];
  }
  function sameEdge(a, b) {
    if (!a.e || !b.e) return false;
    return (a.e[0] === b.e[0] && a.e[1] === b.e[1]) || (a.e[0] === b.e[1] && a.e[1] === b.e[0]);
  }
  function onEdgeOf(nodeLocA, edgeLoc) { return nodeLocA.n && edgeLoc.e && (edgeLoc.e[0] === nodeLocA.n || edgeLoc.e[1] === nodeLocA.n); }
  // Shortest path (Dijkstra) between two locations; returns a list of locations.
  function route(from, to) {
    if (dist(from, to) < 0.5) return [from];
    if (sameEdge(from, to) || onEdgeOf(from, to) || onEdgeOf(to, from)) return [from, to];
    var D = {}, P = {}, done = {};
    ends(from).forEach(function (s) { D[s.id] = s.d; P[s.id] = null; });
    for (;;) {
      var u = null;
      for (var k in D) if (!done[k] && (u === null || D[k] < D[u])) u = k;
      if (u === null) break;
      done[u] = true;
      NODES[u].adj.forEach(function (a) {
        var nd = D[u] + a.d;
        if (D[a.id] == null || nd < D[a.id]) { D[a.id] = nd; P[a.id] = u; }
      });
    }
    var best = null, bestD = Infinity;
    ends(to).forEach(function (e) { if (D[e.id] != null && D[e.id] + e.d < bestD) { bestD = D[e.id] + e.d; best = e.id; } });
    var chain = [];
    for (var c = best; c != null; c = P[c]) chain.unshift(nodeLoc(c));
    var out = [from].concat(chain, [to]);
    return out.filter(function (p, i) { return i === 0 || dist(p, out[i - 1]) > 0.5; });
  }
  function pathLen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += dist(p[i - 1], p[i]); return L; }

  // ---------------------------------------------------------------- state
  var state, ui = {
    view: 'overview', dirty: true, sel: null, detail: null,
    dl: { f: 'all', q: '', sort: 'tc', dir: -1, limit: 25 },
    seen: {}, arrived: {}, apiShow: false
  };

  function today(ms) { var d = new Date(ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hourOf(ms) { return new Date(ms).getHours(); }
  var NAMES = {
    en: { f: ['Lucía', 'Martín', 'Sofía', 'Hugo', 'Elena', 'Pablo', 'Carmen', 'Diego', 'Laura', 'Álvaro', 'Marta', 'Javier', 'Irene', 'Sergio', 'Nuria', 'Adrián'], l: ['García', 'López', 'Martín', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Ruiz', 'Gil', 'Ortega', 'Molina', 'Castro'] },
    pl: { f: ['Anna', 'Piotr', 'Zofia', 'Jakub', 'Maria', 'Tomasz', 'Ewa', 'Michał', 'Julia', 'Kacper', 'Natalia', 'Paweł', 'Ola', 'Marek', 'Ida', 'Bartek'], l: ['Nowak', 'Kowalski', 'Wiśniewska', 'Wójcik', 'Kamińska', 'Lewandowski', 'Zielińska', 'Szymański', 'Dąbrowska', 'Mazur', 'Krawczyk', 'Kaczmarek'] }
  };
  function randName() { var N = NAMES[LANG] || NAMES.en; return pick(N.f) + ' ' + pick(N.l); }
  function randPhone() { return LANG === 'pl' ? '+48 ' + rint(500, 799) + ' ' + rint(100, 999) + ' ' + rint(100, 999) : '+34 6' + rint(10, 99) + ' ' + rint(100, 999) + ' ' + rint(100, 999); }
  function randKey() { var h = ''; var a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = rint(0, 255); }); a.forEach(function (b) { h += (b < 16 ? '0' : '') + b.toString(16); }); return 'dng_live_' + h; }

  function fresh() {
    var now = new Date();
    if (now.getHours() < 9) now.setHours(12, now.getMinutes(), 0, 0);   // keep the demo inside service hours
    var clock = now.getTime(), h = now.getHours(), frac = now.getMinutes() / 60;
    var hours = [], yday = [];
    for (var i = 0; i < 24; i++) {
      var base = CURVE[i];
      var v = i < h ? Math.round(base * rnd(0.85, 1.15)) : i === h ? Math.round(base * frac * rnd(0.85, 1.15)) : 0;
      hours.push(v);
      yday.push(Math.round(base * rnd(0.82, 0.96)));
    }
    var todayN = hours.reduce(function (a, b) { return a + b; }, 0);
    var done = Math.max(0, todayN - 2);
    var s = {
      v: 1, lang: LANG, clock: clock, day: today(clock), seq: 4790,
      sim: { on: true, speed: 1 },
      stats: { today: todayN, hours: hours, yday: yday, done: done, onTime: Math.round(done * 0.976), tripSum: done * rnd(860, 880), tripN: done, ydayOnTime: 96.2, ydayAvg: 920 },
      deliveries: [], robots: [], events: [], hookLog: [],
      integ: { api: { on: true, key: randKey() }, hooks: { on: true, url: 'https://example.com/webhooks/delivery' }, shop: { on: false }, pos: { on: true }, sms: { on: true } },
      team: [
        { id: 1, name: t('user.name'), email: 'you@example.com', role: 'admin', st: 'active', last: Date.now(), you: true },
        { id: 2, name: randName(), email: 'ops.lead@example.com', role: 'admin', st: 'active', last: Date.now() - 18 * 60e3 },
        { id: 3, name: randName(), email: 'dispatch1@example.com', role: 'dispatcher', st: 'active', last: Date.now() - 3 * 60e3 },
        { id: 4, name: randName(), email: 'dispatch2@example.com', role: 'dispatcher', st: 'active', last: Date.now() - 2.5 * 3600e3 },
        { id: 5, name: randName(), email: 'kitchen@example.com', role: 'viewer', st: 'active', last: Date.now() - 26 * 3600e3 },
        { id: 6, name: randName(), email: 'finance@example.com', role: 'viewer', st: 'invited', last: null }
      ],
      teamSeq: 7
    };
    // robots: 12 online (2 of them charging), 2 in maintenance
    for (var r = 0; r < 14; r++) {
      var hub = r % 2, loc = HUBS[hub];
      s.robots.push({
        id: 'R-' + pad(r + 1), loc: loc, x: loc.x, y: loc.y, a: 0, path: null, pi: 0, ps: 0, pl: 0, pd: 0,
        st: r >= 12 ? 'offline' : (r === 4 || r === 9) ? 'charging' : 'idle',
        battery: r >= 12 ? rint(5, 15) : (r === 4 || r === 9) ? rint(28, 48) : rint(58, 97),
        del: null, wait: 0, trips: rint(6, 19), odo: rint(9000, 26000), hub: hub, lowEv: false
      });
    }
    // history: delivered earlier today
    for (var k = 0; k < 36; k++) {
      var td = clock - (k + 1) * rnd(4, 9) * 60e3, trip = rnd(9, 19) * 60e3;
      var st = rint(0, 6), no = rint(1, 60);
      s.deliveries.push({
        id: s.seq++, a: { s: st, no: no, fl: Math.random() < 0.3 ? pick(['1A', '2B', '3', '4C', 'Bajo']) : '' }, loc: addrLoc(st, no),
        hub: rint(0, 1), size: pick(['s', 'm', 'm', 'l']), prio: Math.random() < 0.2 ? 'exp' : 'std',
        name: randName(), phone: randPhone(), note: '', st: Math.random() < 0.04 ? 'cancelled' : 'done', r: rint(0, 11),
        tc: td - trip, ta: td - trip + 30e3, tp: td - trip * 0.55, td: td, eta: td - trip * 0.55 + trip * 0.5,
        pin: pad(rint(0, 99)) + pad(rint(0, 99)), src: pick(['api', 'pos', 'pos', 'manual'])
      });
    }
    s.deliveries.forEach(function (d) { if (d.st === 'cancelled') { d.tx = d.tp; d.td = null; } });
    s.deliveries.sort(function (a, b) { return a.id - b.id; });
    s.deliveries.forEach(function (d, i) { d.id = 4790 + i; });
    s.seq = 4790 + s.deliveries.length;
    return s;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.v === 1 && s.robots && s.robots.length === 14) return s;
      }
    } catch (e) { /* private mode or corrupted data: start fresh */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- events
  var EV_ICON = { created: ['package', 'go'], picked: ['route', 'go'], done: ['check', 'ok'], low: ['batt', 'warn'], charged: ['bolt', 'ok'], cancel: ['x', 'bad'], queued: ['package', 'warn'] };
  var silent = false;
  function addEvent(k, v) {
    state.events.unshift({ k: k, v: v, t: state.clock, r: silent });
    if (state.events.length > 60) state.events.length = 60;
    ui.dirty = true;
    if (!silent) { renderNotifs(true); }
  }
  function evText(e) {
    var v = Object.assign({}, e.v);
    if (v.d != null) { var d = findDel(v.d); v.a = d ? addrText(d) : ''; v.id = v.d; }
    return t('ev.' + e.k, v);
  }
  function hook(ev, id) {
    var h = state.integ.hooks;
    if (!h.on || !h.url) return;
    state.hookLog.unshift({ t: state.clock, ev: ev, id: id, ms: rint(48, 190), code: 200 });
    if (state.hookLog.length > 30) state.hookLog.length = 30;
  }

  // ---------------------------------------------------------------- deliveries
  function findDel(id) { for (var i = state.deliveries.length - 1; i >= 0; i--) if (state.deliveries[i].id === id) return state.deliveries[i]; return null; }
  function addrText(d) {
    var street = d.a.s >= 0 ? STREETS[d.a.s] : d.a.txt;
    return t('fmt.addr', { street: street, no: d.a.no }) + (d.a.fl ? ', ' + d.a.fl : '');
  }
  function isActive(d) { return d.st === 'queued' || d.st === 'assigned' || d.st === 'route'; }
  function hubName(i) { return t('hub.' + i); }

  // Parse "Calle Sol 12" / "ul. Słoneczna 12" into {s, no, txt}
  function parseAddr(str) {
    var m = String(str).match(/(\d{1,4})/);
    if (!m) return null;
    var no = parseInt(m[1], 10);
    if (!no) return null;
    var n = norm(str), best = -1, bestLen = 0;
    STREETS.forEach(function (s, i) {
      var full = norm(s), core = full.replace(/^(calle del|calle|pasaje|ul|plac|zaulek|plaza)\s+/, '');
      [full, core].forEach(function (c) { if (c.length > 2 && n.indexOf(c) !== -1 && c.length > bestLen) { best = i; bestLen = c.length; } });
    });
    var txt = String(str).replace(m[1], '').replace(/[,\s]+$/, '').replace(/\s{2,}/g, ' ').trim();
    if (best === -1 && txt.length < 3) return null;
    return { s: best, no: no, txt: txt, geo: best >= 0 ? best : hash(norm(txt)) % STREETS.length };
  }

  function bestRobot(hub) {
    var hubLoc = HUBS[hub], best = null, bestL = Infinity;
    state.robots.forEach(function (r, i) {
      if (r.del != null || r.battery < 22) return;
      if (!(r.st === 'idle' || r.st === 'return' || (r.st === 'charging' && r.battery >= 50))) return;
      if (r.st === 'return' && r.lowEv) return;
      var L = pathLen(route(locNow(r), hubLoc));
      if (L < bestL) { bestL = L; best = i; }
    });
    return best == null ? null : { i: best, L: bestL };
  }
  function estimate(hub, loc) {
    var b = bestRobot(hub), toHub = b ? b.L : 260;
    var L = toHub + pathLen(route(HUBS[hub], loc));
    return L / PX_PER_SIM_S + DWELL_PICKUP + DWELL_DROP + (b ? 0 : 240);
  }

  function createDelivery(o) {
    var a = o.a, loc = addrLoc(a.geo != null ? a.geo : a.s, a.no);
    var est = estimate(o.hub, loc);
    var d = {
      id: state.seq++, a: { s: a.s, no: a.no, txt: a.txt || '', fl: o.fl || '' }, loc: loc, hub: o.hub,
      size: o.size || 'm', prio: o.prio || 'std', name: o.name, phone: o.phone, note: o.note || '',
      st: 'queued', r: null, tc: state.clock, eta: state.clock + est * 1000, promise: state.clock + (est * 1.3 + 120) * 1000,
      pin: pad(rint(0, 99)) + pad(rint(0, 99)), src: o.src || 'manual'
    };
    state.deliveries.push(d);
    if (state.deliveries.length > 400) state.deliveries.splice(0, state.deliveries.length - 400);
    state.stats.today++;
    state.stats.hours[hourOf(state.clock)]++;
    addEvent('created', { d: d.id });
    hook('delivery.created', d.id);
    tryAssign(d);
    if (d.st === 'queued') addEvent('queued', { d: d.id });
    ui.dirty = true;
    return d;
  }
  function tryAssign(d) {
    var b = bestRobot(d.hub);
    if (!b) return false;
    var r = state.robots[b.i];
    r.del = d.id; r.st = 'pickup'; r.lowEv = false;
    setRoute(r, HUBS[d.hub]);
    d.st = 'assigned'; d.r = b.i; d.ta = state.clock;
    d.eta = state.clock + ((b.L + pathLen(route(HUBS[d.hub], d.loc))) / PX_PER_SIM_S + DWELL_PICKUP + DWELL_DROP) * 1000;
    hook('delivery.assigned', d.id);
    return true;
  }
  function cancelDelivery(d) {
    if (!isActive(d)) return;
    if (d.r != null) {
      var r = state.robots[d.r];
      if (r.del === d.id) {
        r.del = null; r.wait = 0;
        setRoute(r, nearestHub(r));
        if (r.st === 'paused') r.prev = 'return'; else r.st = 'return';
      }
    }
    var wasQueued = d.st === 'queued';
    d.st = 'cancelled'; d.tx = state.clock;
    state.stats.today = Math.max(0, state.stats.today - 1);
    var h = hourOf(d.tc); if (today(d.tc) === state.day && state.stats.hours[h] > 0) state.stats.hours[h]--;
    addEvent('cancel', { d: d.id });
    hook('delivery.cancelled', d.id);
    ui.dirty = true;
    return wasQueued;
  }

  // ---------------------------------------------------------------- robots
  function locNow(r) {
    if (!r.path || r.pi >= r.path.length - 1) return r.loc;
    var A = r.path[r.pi], B = r.path[r.pi + 1], p = { x: r.x, y: r.y };
    if (A.n && B.n) p.e = [A.n, B.n];
    else if (A.e) p.e = A.e;
    else if (B.e) p.e = B.e;
    else p.e = [A.n, B.n];
    if (dist(p, A) < 0.5) return A;
    if (dist(p, B) < 0.5) return B;
    return p;
  }
  function setRoute(r, to) {
    var p = route(locNow(r), to);
    if (p.length < 2) { r.path = null; r.loc = to; r.x = to.x; r.y = to.y; r.pl = 0; r.pd = 0; return; }
    r.path = p; r.pi = 0; r.ps = 0; r.pl = pathLen(p); r.pd = 0;
  }
  function nearestHub(r) {
    var here = locNow(r), a = pathLen(route(here, HUBS[0])), b = pathLen(route(here, HUBS[1]));
    r.hub = a <= b ? 0 : 1;
    return HUBS[r.hub];
  }
  function moveRobot(r, px) {
    var moved = 0;
    while (px > 0 && r.pi < r.path.length - 1) {
      var A = r.path[r.pi], B = r.path[r.pi + 1], seg = dist(A, B), rem = seg - r.ps;
      if (px < rem) { r.ps += px; moved += px; px = 0; }
      else { px -= rem; moved += rem; r.pi++; r.ps = 0; }
    }
    if (r.pi >= r.path.length - 1) {
      var L = r.path[r.path.length - 1];
      r.x = L.x; r.y = L.y; r.loc = L; r.path = null;
    } else {
      var P = r.path[r.pi], Q = r.path[r.pi + 1], f = r.ps / dist(P, Q);
      r.x = P.x + (Q.x - P.x) * f; r.y = P.y + (Q.y - P.y) * f;
      r.a = Math.atan2(Q.y - P.y, Q.x - P.x) * 180 / Math.PI;
    }
    r.pd += moved; r.odo += moved;
    r.battery = Math.max(0, r.battery - moved * DRAIN_PER_PX);
    return !r.path;
  }
  function robotStep(r, i, dtReal, simDt) {
    if (r.st === 'offline' || r.st === 'paused') return;
    if (r.path) {
      if (moveRobot(r, dtReal * state.sim.speed * BASE_PX)) {
        r.wait = r.st === 'pickup' ? DWELL_PICKUP : r.st === 'route' ? DWELL_DROP : 0;
      }
      return;
    }
    if (r.wait > 0) { r.wait -= simDt; return; }
    var d = r.del != null ? findDel(r.del) : null;
    switch (r.st) {
      case 'pickup':
        if (!d) { r.st = 'idle'; return; }
        d.st = 'route'; d.tp = state.clock;
        r.st = 'route'; setRoute(r, d.loc);
        addEvent('picked', { r: r.id, d: d.id });
        hook('delivery.en_route', d.id);
        break;
      case 'route':
        if (d) {
          d.st = 'done'; d.td = state.clock;
          var S = state.stats;
          S.done++; S.tripN++; S.tripSum += (d.td - d.tc) / 1000;
          if (d.td <= (d.promise || d.eta + 600e3)) S.onTime++;
          r.trips++;
          ui.arrived[d.id] = performance.now() + 2600;
          addEvent('done', { d: d.id });
          hook('delivery.delivered', d.id);
        }
        r.del = null; r.st = 'return'; setRoute(r, nearestHub(r));
        break;
      case 'return':
        r.st = (r.lowEv || r.battery < 70) ? 'charging' : 'idle';
        break;
      case 'charging':
        r.battery = Math.min(100, r.battery + CHARGE_PER_S * simDt);
        if (r.battery >= 100) {
          r.st = 'idle';
          if (r.lowEv) { r.lowEv = false; addEvent('charged', { r: r.id }); }
        }
        break;
      case 'idle':
        if (r.battery < 20) {
          r.lowEv = true; r.st = 'return'; setRoute(r, nearestHub(r));
          addEvent('low', { r: r.id });
        }
        break;
    }
    ui.dirty = true;
  }

  // ---------------------------------------------------------------- simulation loop
  var assignTimer = 0, uiTimer = 0, saveTimer = 0;
  function autoSources() {
    var I = state.integ, s = [];
    if (I.api.on) s.push('api');
    if (I.shop.on) s.push('shop');
    if (I.pos.on) s.push('pos', 'pos');
    return s;
  }
  function spawnAuto() {
    var srcs = autoSources();
    if (!srcs.length) return;
    var st = rint(0, STREETS.length - 1), no = rint(1, 60);
    createDelivery({
      a: { s: st, no: no }, fl: Math.random() < 0.35 ? pick(['1A', '2B', '3', '4C', 'Bajo B', '2']) : '',
      hub: Math.random() < 0.62 ? 0 : 1, size: pick(['s', 'm', 'm', 'l']), prio: Math.random() < 0.18 ? 'exp' : 'std',
      name: randName(), phone: randPhone(), src: pick(srcs)
    });
  }
  function rollDay() {
    var d = today(state.clock);
    if (d === state.day) return;
    var S = state.stats;
    S.yday = S.hours.slice(); S.hours = S.hours.map(function () { return 0; });
    S.ydayOnTime = S.done ? S.onTime / S.done * 100 : S.ydayOnTime; S.ydayAvg = S.tripN ? S.tripSum / S.tripN : S.ydayAvg;
    S.today = 0; S.done = 0; S.onTime = 0; S.tripSum = 0; S.tripN = 0;
    state.day = d;
    state.robots.forEach(function (r) { r.trips = 0; r.odo = 0; });
  }
  function tick(dtReal) {
    var simDt = dtReal * state.sim.speed * SIM_RATE;
    state.clock += simDt * 1000;
    rollDay();
    var active = state.deliveries.filter(isActive).length;
    var rate = Math.max(CURVE[hourOf(state.clock)], 12) / 3600;
    if (active < MAX_ACTIVE && Math.random() < rate * simDt) spawnAuto();
    assignTimer += dtReal;
    if (assignTimer > 0.5) {
      assignTimer = 0;
      state.deliveries.filter(function (d) { return d.st === 'queued'; })
        .sort(function (a, b) { return (a.prio === 'exp' ? 0 : 1) - (b.prio === 'exp' ? 0 : 1) || a.tc - b.tc; })
        .forEach(function (d) { if (tryAssign(d)) ui.dirty = true; });
      state.team.forEach(function (m) { if (m.st === 'invited' && m.inv && Date.now() - m.inv > 20000) { m.st = 'active'; m.last = Date.now(); ui.dirty = true; } });
    }
    state.robots.forEach(function (r, i) { robotStep(r, i, dtReal, simDt); });
  }

  var last = 0;
  function frame(now) {
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (state.sim.on && dt > 0) tick(dt);
    maps.forEach(function (m) { m.update(now); });
    uiTimer += dt; saveTimer += dt;
    if (uiTimer > 0.4) { uiTimer = 0; refresh(); }
    if (saveTimer > 2) { saveTimer = 0; save(); }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- map
  var maps = [];
  function blocksSvg() {
    var cols = [[0, 90], [90, 230], [230, 380], [380, 500], [500, 600]], rows = [[0, 70], [70, 180], [180, 290], [290, 360]];
    var out = '';
    rows.forEach(function (rw, ri) {
      var cs = cols.slice();
      if (ri === 0 || ri === 3) cs = [[0, 90], [90, 230], [230, 500], [500, 600]];
      cs.forEach(function (c, ci) {
        var x0 = c[0] === 0 ? -10 : c[0] + 11, x1 = c[1] === W ? W + 10 : c[1] - 11;
        var y0 = rw[0] === 0 ? -10 : rw[0] + 11, y1 = rw[1] === H ? H + 10 : rw[1] - 11;
        if (ri === 1 && c[0] === 90) {
          out += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" rx="8" fill="#dcefe1"/>';
          out += '<g fill="#cfe6d5"><circle cx="' + (x0 + 26) + '" cy="' + (y0 + 24) + '" r="11"/><circle cx="' + (x1 - 30) + '" cy="' + (y0 + 30) + '" r="14"/><circle cx="' + (x0 + 60) + '" cy="' + (y1 - 22) + '" r="12"/><circle cx="' + (x1 - 22) + '" cy="' + (y1 - 20) + '" r="9"/></g>';
          out += '<path d="M' + (x0 + 6) + ' ' + ((y0 + y1) / 2) + ' Q' + ((x0 + x1) / 2) + ' ' + (y0 + 8) + ' ' + (x1 - 6) + ' ' + ((y0 + y1) / 2 + 10) + '" stroke="#eaf5ed" stroke-width="5" fill="none" stroke-linecap="round"/>';
          return;
        }
        var w = x1 - x0;
        if (w > 150) {
          var mid = x0 + Math.round(w * (0.45 + ((ri + ci) % 3) * 0.06));
          out += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (mid - 5 - x0) + '" height="' + (y1 - y0) + '" rx="5"/>';
          out += '<rect x="' + (mid + 5) + '" y="' + y0 + '" width="' + (x1 - mid - 5) + '" height="' + (y1 - y0) + '" rx="5"/>';
        } else {
          out += '<rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + (y1 - y0) + '" rx="5"/>';
        }
      });
    });
    return out;
  }
  function streetsSvg() {
    var d = STREET_GEO.map(function (s) { return s.y != null ? 'M' + s.a + ' ' + s.y + ' H' + s.b : 'M' + s.x + ' ' + s.a + ' V' + s.b; }).join(' ');
    var labels = STREET_GEO.map(function (s, i) {
      return s.y != null
        ? '<text x="' + (s.a + 8) + '" y="' + (s.y - 8) + '">' + esc(STREETS[i]) + '</text>'
        : '<text transform="translate(' + (s.x - 8) + ' ' + (s.b - 8) + ') rotate(-90)">' + esc(STREETS[i]) + '</text>';
    }).join('');
    return '<path d="' + d + '" stroke="#fff" stroke-width="10" fill="none"/><g class="street-lbl" font-size="8" fill="#a1a1a6">' + labels + '</g>';
  }
  function cloneDef(id) { var g = document.getElementById(id); return g ? g.innerHTML : ''; }

  function createMap(host, opts) {
    opts = opts || {};
    var NS = 'http://www.w3.org/2000/svg';
    host.innerHTML =
      '<svg class="map" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('map.label')) + '">' +
      '<rect width="' + W + '" height="' + H + '" fill="#eef0f3"/>' +
      '<g fill="#e1e5e9">' + blocksSvg() + '</g>' + streetsSvg() +
      '<g class="routes"></g><g class="dests"></g>' +
      '<g class="hubs">' + HUBS.map(function (h, i) {
        return '<g transform="translate(' + h.x + ' ' + h.y + ')"><title>' + esc(t('map.hub')) + ': ' + esc(hubName(i)) + '</title><g transform="scale(.82)">' + cloneDef('app-hub') + '</g>' +
          '<text class="hub-lbl" x="0" y="' + (i === 0 ? -15 : 4) + '" ' + (i === 0 ? 'text-anchor="middle"' : 'dx="15"') + '>' + esc(hubName(i).split(' · ')[0]) + '</text></g>';
      }).join('') + '</g>' +
      '<g class="bots"></g></svg>' +
      '<div class="app-map-legend"><span><i></i>' + esc(t('map.legend_active')) + '</span><span><i class="idle"></i>' + esc(t('map.legend_idle')) + '</span><span><i class="charge"></i>' + esc(t('map.legend_charge')) + '</span></div>' +
      '<div class="app-map-tip" hidden></div>';
    if (opts.labels) host.classList.add('app-map--labels');
    var svg = $('svg', host), gR = $('.routes', svg), gD = $('.dests', svg), gB = $('.bots', svg), tip = $('.app-map-tip', host);
    var bots = [], routes = [], dests = {}, tipFor = null, tipPinned = false;
    var markerHtml = cloneDef('app-bot'), destHtml = cloneDef('app-dest');
    state.robots.forEach(function (r, i) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'route'); gR.appendChild(p); routes.push(p);
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'rbot'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
      g.setAttribute('aria-label', r.id);
      g.innerHTML = '<circle class="sel" r="13"/><g class="bot-body" transform="scale(.78)"><path class="heading" d="M0 -20 L7 -9 H-7 Z"/>' + markerHtml + '</g><text class="lbl" y="-14" text-anchor="middle">' + r.id + '</text>';
      g.addEventListener('mouseenter', function () { if (!tipPinned) tipFor = i; });
      g.addEventListener('mouseleave', function () { if (!tipPinned) tipFor = null; });
      g.addEventListener('click', function (e) { e.stopPropagation(); selectRobot(i, true); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRobot(i, true); } });
      gB.appendChild(g); bots.push(g);
    });
    svg.addEventListener('click', function () { selectRobot(null); });

    function slotOffsets() {
      var groups = [[], []], off = {};
      state.robots.forEach(function (r, i) {
        if (r.path || r.st === 'offline') return;
        for (var h = 0; h < 2; h++) if (dist(r, HUBS[h]) < 1) groups[h].push(i);
      });
      groups.forEach(function (g, h) {
        g.forEach(function (i, k) {
          var o = (k - (g.length - 1) / 2) * 13;
          off[i] = HUB_AXIS[h] === 'x' ? { x: o, y: 0 } : { x: 0, y: o };
        });
      });
      return off;
    }
    var api = {
      host: host,
      update: function (now) {
        var off = slotOffsets();
        state.robots.forEach(function (r, i) {
          var g = bots[i], o = off[i] || { x: 0, y: 0 };
          var x = r.x + o.x, y = r.y + o.y;
          g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
          var cls = 'rbot rbot--' + (r.st === 'pickup' || r.st === 'route' || r.st === 'return' ? 'active' : r.st) + (ui.sel === i ? ' is-sel' : '');
          if (g.getAttribute('class') !== cls) g.setAttribute('class', cls);
          var h = g.querySelector('.heading'); h.setAttribute('transform', 'rotate(' + Math.round(r.a + 90) + ')');
          var rp = routes[i];
          if (r.path && r.st !== 'offline' && (r.st !== 'return' || ui.sel === i)) {
            var d = 'M' + r.x.toFixed(1) + ' ' + r.y.toFixed(1);
            for (var k = r.pi + 1; k < r.path.length; k++) d += ' L' + r.path[k].x + ' ' + r.path[k].y;
            rp.setAttribute('d', d);
            rp.setAttribute('class', 'route' + (ui.sel === i ? ' is-sel' : ''));
          } else if (rp.getAttribute('d')) rp.removeAttribute('d');
        });
        // destination pins: active deliveries with a robot, plus a short "arrived" animation
        var want = {};
        state.deliveries.forEach(function (d) { if (d.st === 'assigned' || d.st === 'route') want[d.id] = d; });
        Object.keys(ui.arrived).forEach(function (id) { if (ui.arrived[id] > now) want[id] = findDel(+id); else delete ui.arrived[id]; });
        Object.keys(want).forEach(function (id) {
          var d = want[id]; if (!d) return;
          var el = dests[id];
          if (!el) {
            el = document.createElementNS(NS, 'g');
            el.setAttribute('class', 'dest is-in');
            el.setAttribute('transform', 'translate(' + d.loc.x + ' ' + d.loc.y + ')');
            el.innerHTML = '<g transform="scale(.62)"><title>#' + d.id + ' · ' + esc(addrText(d)) + '</title>' + destHtml + '</g>';
            el.addEventListener('click', function (e) { e.stopPropagation(); openDetail(d.id); });
            gD.appendChild(el); dests[id] = el;
          }
          if (ui.arrived[id] && !el.classList.contains('arrived')) el.classList.add('arrived');
        });
        Object.keys(dests).forEach(function (id) { if (!want[id]) { dests[id].remove(); delete dests[id]; } });
        // tooltip
        var ti = tipPinned ? ui.sel : tipFor;
        if (ti == null || state.robots[ti].st === 'offline') { if (!tip.hidden) tip.hidden = true; }
        else {
          var r = state.robots[ti], o2 = off[ti] || { x: 0, y: 0 };
          var html = robotTip(r);
          if (tip.dataset.html !== html) { tip.innerHTML = html; tip.dataset.html = html; }
          tip.style.left = ((r.x + o2.x) / W * 100) + '%';
          tip.style.top = ((r.y + o2.y) / H * 100) + '%';
          tip.hidden = false;
        }
      },
      pin: function (on) { tipPinned = on; }
    };
    maps.push(api);
    return api;
  }
  function robotTip(r) {
    var d = r.del != null ? findDel(r.del) : null;
    return '<b>' + r.id + ' ' + robotBadge(r) + '</b>' +
      '<p>' + esc(t('fl.battery')) + ': ' + Math.round(r.battery) + '%</p>' +
      (d ? '<p>#' + d.id + ' · ' + esc(addrText(d)) + '</p>' : '');
  }
  function selectRobot(i, fromMap) {
    ui.sel = i;
    maps.forEach(function (m) { m.pin(i != null); });
    $$('.app-robot').forEach(function (el) { el.classList.toggle('is-sel', i != null && +el.dataset.k === i); });
    if (fromMap && i != null && ui.view === 'fleet') {
      var card = $('.app-robot[data-k="' + i + '"]');
      if (card) card.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }

  // ---------------------------------------------------------------- badges
  var DEL_BADGE = { queued: 'warn', assigned: 'wait', route: 'go', done: 'ok', cancelled: 'bad' };
  function delBadge(d) { return '<span class="badge badge--' + DEL_BADGE[d.st] + '">' + esc(t('s.' + d.st)) + '</span>'; }
  var ROB_BADGE = { idle: 'wait', pickup: 'go', route: 'go', 'return': 'wait', charging: 'ok', paused: 'warn', offline: 'bad' };
  function robotBadge(r) { return '<span class="badge badge--' + ROB_BADGE[r.st] + '">' + esc(t('r.' + r.st)) + '</span>'; }

  // ---------------------------------------------------------------- list patching
  function patchList(box, items, key, sig, html, opts) {
    opts = opts || {};
    var old = {};
    Array.prototype.forEach.call(box.children, function (el) { if (el.dataset.k != null) old[el.dataset.k] = el; else el.remove(); });
    var prev = null;
    items.forEach(function (it) {
      var k = String(key(it)), s = sig(it), el = old[k];
      if (el && el.dataset.s === s) { delete old[k]; }
      else {
        var n = frag(html(it));
        n.dataset.k = k; n.dataset.s = s;
        if (el) {
          var b = $('.badge', n); if (b && opts.flash) b.classList.add('flash');
          el.replaceWith(n); delete old[k];
        } else if (opts.animate) n.classList.add('is-new');
        applyDyn(n);
        el = n;
      }
      var want = prev ? prev.nextSibling : box.firstChild;
      if (want !== el) box.insertBefore(el, want);
      prev = el;
    });
    Object.keys(old).forEach(function (k) { old[k].remove(); });
  }

  // ---------------------------------------------------------------- views
  var VIEWS = {};
  var view = null;

  function headDate() {
    var d = new Date(state.clock);
    return cap(WD.format(d)) + ', ' + hhmm(state.clock);
  }
  function agoText(ms) {
    var m = Math.floor((state.clock - ms) / 60000);
    if (m < 1) return t('ago.now');
    if (m < 60) return t('ago.min', { n: m });
    return t('ago.h', { n: Math.floor(m / 60) });
  }
  function kpis() {
    var S = state.stats, h = hourOf(state.clock), frac = new Date(state.clock).getMinutes() / 60;
    var ySame = 0; for (var i = 0; i < h; i++) ySame += S.yday[i]; ySame += S.yday[h] * frac;
    var dPct = ySame ? (S.today / ySame - 1) * 100 : 0;
    var onT = S.done ? S.onTime / S.done * 100 : 100;
    var avg = S.tripN ? S.tripSum / S.tripN : 0;
    var online = state.robots.filter(function (r) { return r.st !== 'offline'; }).length;
    var chg = state.robots.filter(function (r) { return r.st === 'charging'; }).length;
    var sign = function (v) { return v >= 0 ? '+' : '−'; };
    return [
      { k: 'today', label: t('k1'), v: NF.format(S.today), raw: S.today, d: sign(dPct) + NF.format(Math.abs(Math.round(dPct))) + '%', neg: dPct < 0 },
      { k: 'ontime', label: t('k2'), v: NF1.format(onT) + '%', d: sign(onT - S.ydayOnTime) + NF1.format(Math.abs(onT - S.ydayOnTime)) + ' pp', neg: onT < S.ydayOnTime },
      { k: 'avg', label: t('k3'), v: mmss(avg), d: sign(avg - S.ydayAvg) + mmss(Math.abs(avg - S.ydayAvg)), neg: avg > S.ydayAvg },
      { k: 'online', label: t('k4'), v: online + '/' + state.robots.length, d: t('k4s', { n: chg }), neg: false }
    ];
  }

  VIEWS.overview = {
    render: function (el) {
      el.innerHTML =
        '<div class="app-head"><div><h1>' + esc(t('today')) + '</h1><p class="sub" data-f="date"></p></div>' +
        '<div class="app-head-actions"><button class="app-btn" type="button" data-act="new"><span class="plus" aria-hidden="true">+</span>' + esc(t('new')) + '</button></div></div>' +
        '<div class="app-kpis">' + kpis().map(function (k) {
          return '<div class="app-kpi"><span>' + esc(k.label) + '</span><b data-kv="' + k.k + '">' + esc(k.v) + '</b><small data-kd="' + k.k + '"></small></div>';
        }).join('') + '</div>' +
        '<div class="app-split">' +
        '<section class="app-card" aria-labelledby="ov-live"><div class="app-card-h"><span id="ov-live">' + esc(t('live')) + '</span><span class="muted">' + esc(t('live_s')) + '</span></div><div class="app-map" data-map></div></section>' +
        '<section class="app-card" aria-labelledby="ov-rec"><div class="app-card-h"><span id="ov-rec">' + esc(t('recent')) + '</span><a href="#deliveries">' + esc(t('all')) + '</a></div><ul class="app-rows" data-recent></ul></section>' +
        '</div>' +
        '<div class="app-split app-split--even">' +
        '<section class="app-card" aria-labelledby="ov-ch"><div class="app-card-h"><span id="ov-ch">' + esc(t('chart')) + '</span><span class="muted">' + esc(t('chart_s')) + '</span></div><div class="app-chart" data-chart data-cols="' + (CHART_TO - CHART_FROM + 1) + '"></div></section>' +
        '<section class="app-card" aria-labelledby="ov-act"><div class="app-card-h"><span id="ov-act">' + esc(t('activity')) + '</span></div><ul class="app-feed" data-feed></ul></section>' +
        '</div>';
      applyDyn(el);
      createMap($('[data-map]', el));
      var ch = $('[data-chart]', el), html = '';
      for (var h = CHART_FROM; h <= CHART_TO; h++) html += '<div class="app-bar-col" tabindex="0" data-h="' + h + '"><em></em><i></i><span>' + (h % 2 ? '' : pad(h)) + '</span></div>';
      ch.innerHTML = html;
      this.first = true;
      this.update(el);
      // count-up on first paint
      if (!reduceMotion) $$('[data-kv="today"]', el).forEach(function (b) {
        var t0 = performance.now();
        b.dataset.counting = '1';
        (function step(now) {
          var p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3);
          b.textContent = NF.format(Math.round(state.stats.today * e));
          if (p < 1) requestAnimationFrame(step); else delete b.dataset.counting;
        })(t0);
      });
    },
    update: function (el) {
      $('[data-f="date"]', el).textContent = headDate();
      var first = this.first; this.first = false;
      kpis().forEach(function (k) {
        var b = $('[data-kv="' + k.k + '"]', el), s = $('[data-kd="' + k.k + '"]', el);
        if (!first && !b.dataset.counting && b.textContent !== k.v) { b.textContent = k.v; b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); }
        s.textContent = k.d; s.classList.toggle('neg', !!k.neg);
        if (k.k === 'online') s.classList.remove('neg');
      });
      var recent = state.deliveries.slice(-7).reverse();
      patchList($('[data-recent]', el), recent, function (d) { return d.id; }, function (d) { return d.st + addrText(d); }, function (d) {
        return '<li><button class="app-row" type="button" data-open="' + d.id + '"><span class="id">#' + d.id + '</span><span class="addr">' + esc(addrText(d)) + '</span>' + delBadge(d) + '</button></li>';
      }, { animate: !first, flash: true });
      // chart
      var hrs = state.stats.hours, max = 1, nowH = hourOf(state.clock);
      for (var h = CHART_FROM; h <= CHART_TO; h++) max = Math.max(max, hrs[h], state.stats.yday[h]);
      $$('.app-bar-col', el).forEach(function (c) {
        var hh = +c.dataset.h, v = hrs[hh] || 0, pct = v / max * 82;
        var i = $('i', c);
        if (first && !reduceMotion) { i.style.height = '0%'; setTimeout(function () { i.style.height = pct + '%'; }, 60 + (hh - CHART_FROM) * 25); }
        else i.style.height = pct + '%';
        c.style.setProperty('--h', pct + '%');
        $('em', c).textContent = v;
        c.classList.toggle('now', hh === nowH);
        c.setAttribute('aria-label', t('chart_label', { n: v, h: pad(hh) }));
      });
      // feed
      var feed = state.events.slice(0, 12);
      var box = $('[data-feed]', el);
      if (!feed.length) { box.innerHTML = '<li class="app-empty">' + esc(t('activity_empty')) + '</li>'; return; }
      patchList(box, feed, function (e) { return e.t + e.k + JSON.stringify(e.v); }, function (e) { return agoText(e.t); }, function (e) {
        var ic = EV_ICON[e.k] || ['package', ''];
        return '<li><span class="app-ev-ic app-ev-ic--' + ic[1] + '">' + icon(ic[0]) + '</span><span>' + esc(evText(e)) + '</span><time>' + esc(agoText(e.t)) + '</time></li>';
      }, { animate: !first });
    }
  };

  function filteredDeliveries() {
    var f = ui.dl.f, q = norm(ui.dl.q);
    var list = state.deliveries.filter(function (d) {
      if (f === 'active' && !isActive(d)) return false;
      if (f === 'done' && d.st !== 'done') return false;
      if (f === 'cancelled' && d.st !== 'cancelled') return false;
      if (q) {
        var hay = norm('#' + d.id + ' ' + d.id + ' ' + addrText(d) + ' ' + d.name + ' ' + (d.r != null ? state.robots[d.r].id : ''));
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var k = ui.dl.sort, dir = ui.dl.dir;
    list.sort(function (a, b) { return ((k === 'id' ? a.id - b.id : (a.tc - b.tc) || (a.id - b.id))) * dir; });
    return list;
  }
  function etaCell(d) {
    if (d.st === 'done') return hhmm(d.td);
    if (d.st === 'cancelled') return '—';
    return '~' + hhmm(d.eta);
  }
  VIEWS.deliveries = {
    render: function (el) {
      var counts = { all: state.deliveries.length, active: 0, done: 0, cancelled: 0 };
      state.deliveries.forEach(function (d) { if (isActive(d)) counts.active++; else if (d.st === 'done') counts.done++; else counts.cancelled++; });
      el.innerHTML =
        '<div class="app-head"><div><h1>' + esc(t('d.title')) + '</h1><p class="sub" data-f="sub"></p></div>' +
        '<div class="app-head-actions"><button class="app-btn app-btn--ghost" type="button" data-act="export">' + icon('download') + esc(t('d.export')) + '</button>' +
        '<button class="app-btn" type="button" data-act="new"><span class="plus" aria-hidden="true">+</span>' + esc(t('new')) + '</button></div></div>' +
        '<section class="app-card"><div class="app-toolbar">' +
        '<div class="app-seg" role="group" aria-label="' + esc(t('col.status')) + '">' + ['all', 'active', 'done', 'cancelled'].map(function (f) {
          return '<button type="button" data-filter="' + f + '" aria-pressed="' + (ui.dl.f === f) + '">' + esc(t('f.' + f)) + ' <span class="n" data-n="' + f + '">' + counts[f] + '</span></button>';
        }).join('') + '</div>' +
        '<input class="app-input" type="search" data-dl-q placeholder="' + esc(t('d.search')) + '" aria-label="' + esc(t('d.search')) + '" value="' + esc(ui.dl.q) + '">' +
        '</div><div class="app-table-wrap"><table class="app-table"><thead><tr>' +
        '<th scope="col" data-sort="id"><button type="button">' + esc(t('col.id')) + '</button></th>' +
        '<th scope="col">' + esc(t('col.addr')) + '</th>' +
        '<th scope="col" class="hide-s">' + esc(t('col.recipient')) + '</th>' +
        '<th scope="col" class="hide-s">' + esc(t('col.robot')) + '</th>' +
        '<th scope="col">' + esc(t('col.status')) + '</th>' +
        '<th scope="col" class="hide-s" data-sort="tc"><button type="button">' + esc(t('col.created')) + '</button></th>' +
        '<th scope="col">' + esc(t('col.eta')) + '</th>' +
        '</tr></thead><tbody data-rows></tbody></table></div><div class="app-table-foot" data-foot></div></section>';
      this.first = true;
      this.update(el);
    },
    update: function (el) {
      var active = state.deliveries.filter(isActive).length;
      $('[data-f="sub"]', el).textContent = t('d.sub', { n: NF.format(state.stats.today), a: active });
      var counts = { all: state.deliveries.length, active: active, done: 0, cancelled: 0 };
      state.deliveries.forEach(function (d) { if (d.st === 'done') counts.done++; else if (d.st === 'cancelled') counts.cancelled++; });
      Object.keys(counts).forEach(function (k) { var n = $('[data-n="' + k + '"]', el); if (n) n.textContent = counts[k]; });
      $$('th[data-sort]', el).forEach(function (th) {
        if (th.dataset.sort === ui.dl.sort) th.setAttribute('aria-sort', ui.dl.dir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort');
      });
      var list = filteredDeliveries(), shown = list.slice(0, ui.dl.limit);
      var body = $('[data-rows]', el);
      if (!shown.length) { body.innerHTML = '<tr class="no-click"><td colspan="7" class="app-empty">' + esc(t('d.empty')) + '</td></tr>'; }
      else {
        patchList(body, shown, function (d) { return d.id; }, function (d) { return d.st + (d.r != null ? d.r : '') + etaCell(d); }, function (d) {
          return '<tr tabindex="0" data-open="' + d.id + '"><td class="id">#' + d.id + '</td>' +
            '<td class="addr">' + esc(addrText(d)) + (d.prio === 'exp' ? '<span class="prio" title="' + esc(t('prio.exp')) + '">' + icon('bolt') + '</span>' : '') + '</td>' +
            '<td class="hide-s">' + esc(d.name) + '</td>' +
            '<td class="hide-s num">' + (d.r != null ? state.robots[d.r].id : '—') + '</td>' +
            '<td>' + delBadge(d) + '</td>' +
            '<td class="hide-s num">' + hhmm(d.tc) + '</td>' +
            '<td class="num">' + etaCell(d) + '</td></tr>';
        }, { animate: !this.first, flash: true });
      }
      this.first = false;
      var foot = $('[data-foot]', el);
      var more = list.length > ui.dl.limit;
      if (more && !$('button', foot)) foot.innerHTML = '<button class="app-btn app-btn--ghost app-btn--sm" type="button" data-act="more">' + esc(t('d.more')) + '</button>';
      if (!more) foot.innerHTML = '';
    }
  };

  function battClass(r) { return r.st === 'charging' ? 'chg' : r.battery < 25 ? 'low' : r.battery < 50 ? 'mid' : ''; }
  function robotTask(r) {
    var d = r.del != null ? findDel(r.del) : null;
    if (d) return '#' + d.id + ' · ' + addrText(d);
    if (r.st === 'return' || r.st === 'charging' || r.st === 'idle') return hubName(r.hub).split(' · ')[0];
    return t('fl.none');
  }
  VIEWS.fleet = {
    render: function (el) {
      el.innerHTML =
        '<div class="app-head"><div><h1>' + esc(t('fl.title')) + '</h1><p class="sub" data-f="sub"></p></div><div class="app-stats" data-stats></div></div>' +
        '<section class="app-card"><div class="app-card-h"><span>' + esc(t('live')) + '</span><span class="muted">' + esc(t('live_s')) + '</span></div><div class="app-map" data-map></div></section>' +
        '<div class="app-robots" data-robots></div>';
      createMap($('[data-map]', el));
      var box = $('[data-robots]', el), miniHtml = cloneDef('app-mini');
      state.robots.forEach(function (r, i) {
        var c = frag('<article class="app-robot" data-k="' + i + '" tabindex="0" aria-label="' + r.id + '">' +
          '<div class="app-robot-h"><svg class="mini" viewBox="0 0 130 100" aria-hidden="true">' + miniHtml + '</svg><b>' + r.id + '</b><span data-f="badge"></span></div>' +
          '<div class="app-batt"><div class="app-batt-bar"><i data-f="bar"></i></div><span data-f="batt"></span></div>' +
          '<dl><dt>' + esc(t('fl.task')) + '</dt><dd data-f="task"></dd><dt>' + esc(t('fl.trips')) + '</dt><dd data-f="trips"></dd><dt>' + esc(t('fl.odo')) + '</dt><dd data-f="odo"></dd></dl>' +
          '<div class="app-robot-a" data-f="actions"></div></article>');
        box.appendChild(c);
      });
      this.update(el);
      if (ui.sel != null) selectRobot(ui.sel);
    },
    update: function (el) {
      var R = state.robots, cnt = { act: 0, idle: 0, chg: 0, off: 0 };
      R.forEach(function (r) {
        if (r.st === 'offline') cnt.off++; else if (r.st === 'charging') cnt.chg++; else if (r.st === 'idle' || r.st === 'paused') cnt.idle++; else cnt.act++;
      });
      $('[data-f="sub"]', el).textContent = t('fl.sub', { n: R.length, m: R.length - cnt.off });
      var stats = '<span class="app-stat"><i></i>' + esc(t('map.legend_active')) + ' <b>' + cnt.act + '</b></span>' +
        '<span class="app-stat"><i class="idle"></i>' + esc(t('map.legend_idle')) + ' <b>' + cnt.idle + '</b></span>' +
        '<span class="app-stat"><i class="charge"></i>' + esc(t('map.legend_charge')) + ' <b>' + cnt.chg + '</b></span>' +
        '<span class="app-stat"><i class="off"></i>' + esc(t('r.offline')) + ' <b>' + cnt.off + '</b></span>';
      var sb = $('[data-stats]', el); if (sb.dataset.s !== stats) { sb.innerHTML = stats; sb.dataset.s = stats; }
      $$('.app-robot', el).forEach(function (c) {
        var r = R[+c.dataset.k];
        var set = function (f, html) { var n = $('[data-f="' + f + '"]', c); if (n.dataset.s !== html) { n.innerHTML = html; n.dataset.s = html; } };
        set('badge', robotBadge(r));
        set('batt', Math.round(r.battery) + '%');
        var bar = $('[data-f="bar"]', c); bar.style.width = r.battery.toFixed(1) + '%'; bar.className = battClass(r);
        set('task', esc(robotTask(r)));
        set('trips', String(r.trips));
        set('odo', NF1.format(r.odo * 0.0012) + ' ' + esc(t('km')));
        c.classList.toggle('is-off', r.st === 'offline');
        c.classList.toggle('is-moving', !!r.path && r.st !== 'paused');
        var a = '';
        if (r.st === 'offline') a = '<button class="app-btn app-btn--sm" type="button" data-robot="online">' + esc(t('a.online')) + '</button>';
        else {
          a = r.st === 'paused'
            ? '<button class="app-btn app-btn--sm" type="button" data-robot="resume">' + icon('play') + esc(t('a.resume')) + '</button>'
            : '<button class="app-btn app-btn--ghost app-btn--sm" type="button" data-robot="pause">' + icon('pause') + esc(t('a.pause')) + '</button>';
          if (r.del == null && r.st !== 'charging' && r.st !== 'paused' && !(r.st === 'return' && r.lowEv)) a += '<button class="app-btn app-btn--ghost app-btn--sm" type="button" data-robot="charge">' + icon('bolt') + esc(t('a.charge')) + '</button>';
        }
        set('actions', a);
      });
    }
  };

  function maskKey(k) { return k.slice(0, 9) + '•'.repeat(18) + k.slice(-4); }
  function intCard(id, ic, title, desc, body) {
    var on = state.integ[id].on, busy = ui.busy === id;
    return '<article class="app-int' + (on ? ' is-on' : '') + '" data-int="' + id + '">' +
      '<div class="app-int-h"><span class="app-int-ic">' + icon(ic) + '</span><div><h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p>' +
      '<span class="app-int-state' + (busy ? ' busy' : on ? ' on' : '') + '">' + esc(busy ? t('i.connecting') : on ? t('i.connected') : t('i.off')) + '</span></div>' +
      '<button class="app-switch" type="button" role="switch" aria-checked="' + on + '"' + (busy ? ' aria-busy="true"' : '') + ' aria-label="' + esc(title) + '" data-toggle="' + id + '"></button></div>' +
      (body || '') + '</article>';
  }
  VIEWS.integrations = {
    render: function (el) {
      var I = state.integ;
      el.innerHTML =
        '<div class="app-head"><div><h1>' + esc(t('i.title')) + '</h1><p class="sub">' + esc(t('i.sub')) + '</p></div>' +
        '<a class="app-btn app-btn--ghost app-btn--sm" href="' + esc(t('i.docs_href')) + '">' + esc(t('i.docs')) + ' →</a></div>' +
        '<div class="app-ints">' +
        intCard('api', 'code', t('i.api'), t('i.api_d'),
          '<div class="app-field"><span class="app-label">' + esc(t('i.key')) + '</span><div class="app-key"><code data-key>' + esc(ui.apiShow ? I.api.key : maskKey(I.api.key)) + '</code>' +
          '<button class="app-btn app-btn--ghost app-btn--sm" type="button" data-act="key-show">' + esc(ui.apiShow ? t('i.hide') : t('i.reveal')) + '</button>' +
          '<button class="app-btn app-btn--ghost app-btn--sm" type="button" data-act="key-copy">' + esc(t('i.copy')) + '</button></div>' +
          '<button class="app-link-btn" type="button" data-act="key-regen">' + esc(t('i.regen')) + '</button></div>') +
        intCard('hooks', 'hook', t('i.hooks'), t('i.hooks_d'),
          '<form class="app-field" data-form="hook" novalidate><label class="app-label" for="hook-url">' + esc(t('i.url')) + '</label><div class="app-inline">' +
          '<input class="app-input" id="hook-url" type="url" placeholder="' + esc(t('i.url_ph')) + '" value="' + esc(I.hooks.url) + '">' +
          '<button class="app-btn app-btn--ghost app-btn--sm" type="submit">' + esc(t('i.save')) + '</button></div><small class="app-err" data-err hidden></small></form>' +
          '<div class="app-field"><div class="app-head"><span class="app-label">' + esc(t('i.log')) + '</span><button class="app-link-btn" type="button" data-act="hook-test">' + esc(t('i.test')) + '</button></div><ul class="app-log" data-log></ul></div>') +
        intCard('shop', 'cart', t('i.shop'), t('i.shop_d')) +
        intCard('pos', 'store', t('i.pos'), t('i.pos_d')) +
        intCard('sms', 'sms', t('i.sms'), t('i.sms_d')) +
        '<article class="app-int"><div class="app-int-h"><span class="app-int-ic">' + icon('file') + '</span><div><h3>' + esc(t('i.csv')) + '</h3><p>' + esc(t('i.csv_d')) + '</p></div></div>' +
        '<label class="app-drop" data-drop><input type="file" accept=".csv,text/csv,text/plain" data-csv>' + icon('download') +
        '<span class="app-btn app-btn--ghost app-btn--sm">' + esc(t('i.csv_btn')) + '</span></label>' +
        '<button class="app-link-btn" type="button" data-act="csv-sample">' + esc(t('i.csv_sample')) + '</button></article>' +
        '</div>';
      this.first = true;
      this.update(el);
    },
    update: function (el) {
      var log = $('[data-log]', el);
      if (!log) return;
      if (!state.hookLog.length) { log.innerHTML = '<li class="empty">' + esc(t('i.log_empty')) + '</li>'; return; }
      patchList(log, state.hookLog.slice(0, 12), function (e) { return e.t + e.ev + e.id; }, function () { return '1'; }, function (e) {
        return '<li><span class="t">' + hhmm(e.t) + '</span><span class="ok">POST ' + e.code + '</span><span>' + esc(e.ev) + (e.id ? ' #' + e.id : '') + '</span><span class="t">' + e.ms + 'ms</span></li>';
      }, { animate: !this.first });
      this.first = false;
    }
  };

  function initials(n) { return n.split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
  var AV_COLORS = ['#007c99', '#1e8e3e', '#6e56cf', '#b25e00', '#c2185b', '#3a4048'];
  VIEWS.team = {
    render: function (el) {
      el.innerHTML =
        '<div class="app-head"><div><h1>' + esc(t('tm.title')) + '</h1><p class="sub" data-f="sub"></p></div>' +
        '<div class="app-head-actions"><button class="app-btn" type="button" data-act="invite"><span class="plus" aria-hidden="true">+</span>' + esc(t('tm.invite')) + '</button></div></div>' +
        '<section class="app-card"><div class="app-table-wrap"><table class="app-table"><thead><tr>' +
        '<th scope="col">' + esc(t('col.name')) + '</th><th scope="col" class="hide-s">' + esc(t('col.email')) + '</th><th scope="col">' + esc(t('col.role')) + '</th>' +
        '<th scope="col" class="hide-s">' + esc(t('col.state')) + '</th><th scope="col" class="hide-s">' + esc(t('col.last')) + '</th><th scope="col"><span class="sr-only">' + esc(t('tm.remove')) + '</span></th>' +
        '</tr></thead><tbody data-rows></tbody></table></div></section>';
      this.first = true;
      this.update(el);
    },
    update: function (el) {
      var inv = state.team.filter(function (m) { return m.st === 'invited'; }).length;
      $('[data-f="sub"]', el).textContent = t('tm.sub', { n: state.team.length, i: inv });
      patchList($('[data-rows]', el), state.team, function (m) { return m.id; }, function (m) { return m.role + m.st + lastSeen(m); }, function (m) {
        var av = m.you ? 'app-avatar--you' : 'c' + (m.id % AV_COLORS.length);
        return '<tr class="no-click"><td><div class="app-member"><span class="app-avatar ' + av + '" data-av="' + (m.you ? '' : AV_COLORS[m.id % AV_COLORS.length]) + '">' + esc(initials(m.you ? t('user.name') : m.name)) + '</span><span>' + esc(m.you ? t('user.name') : m.name) + (m.you ? '<span class="you">(' + esc(t('tm.you')) + ')</span>' : '') + '</span></div></td>' +
          '<td class="hide-s num">' + esc(m.email) + '</td>' +
          '<td><select class="app-select" data-role="' + m.id + '" aria-label="' + esc(t('col.role')) + ' — ' + esc(m.name) + '"' + (m.you ? ' disabled' : '') + '>' +
          ['admin', 'dispatcher', 'viewer'].map(function (r) { return '<option value="' + r + '"' + (m.role === r ? ' selected' : '') + '>' + esc(t('role.' + r)) + '</option>'; }).join('') + '</select></td>' +
          '<td class="hide-s"><span class="badge badge--' + (m.st === 'active' ? 'ok' : 'wait') + '">' + esc(t('st.' + m.st)) + '</span></td>' +
          '<td class="hide-s num">' + esc(lastSeen(m)) + '</td>' +
          '<td>' + (m.you ? '' : '<button class="app-x" type="button" data-remove="' + m.id + '" aria-label="' + esc(t('tm.remove')) + ' — ' + esc(m.name) + '">' + icon('x') + '</button>') + '</td></tr>';
      }, { animate: !this.first, flash: true });
      $$('[data-av]', el).forEach(function (a) { if (a.dataset.av) a.style.background = a.dataset.av; });
      this.first = false;
    }
  };
  function lastSeen(m) {
    if (m.st === 'invited' || !m.last) return '—';
    var min = Math.floor((Date.now() - m.last) / 60000);
    if (m.you || min < 1) return t('ago.now');
    if (min < 60) return t('ago.min', { n: min });
    return t('ago.h', { n: Math.floor(min / 60) });
  }

  // ---------------------------------------------------------------- router
  var viewEl = $('#view');
  function go(name, focus) {
    if (!VIEWS[name]) name = 'overview';
    maps.length = 0;
    ui.view = name;
    view = VIEWS[name];
    viewEl.classList.remove('v-enter');
    view.render(viewEl);
    if (!reduceMotion) { void viewEl.offsetWidth; viewEl.classList.add('v-enter'); }
    $$('[data-nav]').forEach(function (a) {
      if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    moveNavInd();
    document.title = t('nav.' + name) + ' · ' + t('meta.title');
    if (focus) viewEl.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function moveNavInd() {
    var ind = $('.app-nav-ind'), a = $('.app-nav a[aria-current="page"]');
    if (!ind || !a) return;
    ind.style.transform = 'translateY(' + a.offsetTop + 'px)';
    ind.style.height = a.offsetHeight + 'px';
  }
  function route_() { go((location.hash || '#overview').slice(1).split('?')[0], true); }
  window.addEventListener('hashchange', route_);

  function refresh() {
    $$('[data-clock]').forEach(function (c) { c.textContent = hhmm(state.clock); });
    var act = state.deliveries.filter(isActive).length;
    $$('[data-count="active"]').forEach(function (c) { c.textContent = act || ''; });
    if (view && view.update) view.update(viewEl);
    if (ui.detail != null) updateDetail();
    ui.dirty = false;
  }

  // ---------------------------------------------------------------- notifications
  var notifBtn = $('[data-act="notif"]'), notifPop = $('#app-notif-pop');
  function renderNotifs(bump) {
    var unread = state.events.filter(function (e) { return !e.r; }).length, dot = $('[data-unread]');
    dot.hidden = !unread; dot.textContent = unread > 9 ? '9+' : unread;
    if (bump && unread && !reduceMotion) { dot.classList.remove('bump'); void dot.offsetWidth; dot.classList.add('bump'); }
    if (notifPop.hidden) return;
    var list = $('[data-notif-list]');
    if (!state.events.length) { list.innerHTML = '<li><span class="empty">' + esc(t('notif.empty')) + '</span></li>'; return; }
    list.innerHTML = state.events.slice(0, 20).map(function (e) {
      var ic = EV_ICON[e.k] || ['package', ''];
      return '<li class="' + (e.r ? '' : 'unread') + '"><span class="app-ev-ic app-ev-ic--' + ic[1] + '">' + icon(ic[0]) + '</span><div>' + esc(evText(e)) + '<time>' + esc(agoText(e.t)) + '</time></div></li>';
    }).join('');
  }
  function togglePop(pop, btn, open) {
    open = open == null ? pop.hidden : open;
    pop.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', String(open));
  }

  // ---------------------------------------------------------------- dialogs
  function openDlg(d) { if (!d.open) d.showModal(); }
  function closeDlg(d) {
    if (!d.open || d.classList.contains('closing')) return;
    if (reduceMotion) { d.close(); return; }
    d.classList.add('closing');
    setTimeout(function () { d.classList.remove('closing'); d.close(); }, 200);
  }
  $$('dialog').forEach(function (d) {
    d.addEventListener('cancel', function (e) { if (d.id !== 'dlg-confirm') { e.preventDefault(); closeDlg(d); } });
    d.addEventListener('click', function (e) { if (e.target === d) closeDlg(d); });
    d.addEventListener('close', function () { if (d.id === 'dlg-detail') ui.detail = null; });
  });
  function confirmDlg(text, ok) {
    var d = $('#dlg-confirm');
    $('[data-confirm-text]', d).textContent = text;
    $('[data-confirm-ok]', d).textContent = ok || 'OK';
    d.returnValue = '';
    openDlg(d);
    return new Promise(function (res) {
      d.addEventListener('close', function h() { d.removeEventListener('close', h); res(d.returnValue === 'yes'); });
    });
  }

  // toasts
  var toasts = $('.app-toasts');
  function toast(msg) {
    var el = frag('<div class="app-toast">' + icon('check') + '<span></span></div>');
    $('span', el).textContent = msg;
    toasts.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 300); }, 3200);
  }

  // ---------------------------------------------------------------- new delivery
  var dlgNew = $('#dlg-new'), formNew = $('[data-form="new"]');
  $('#n-streets').innerHTML = STREETS.map(function (s) { return '<option value="' + esc(s) + ' "></option>'; }).join('');
  function fieldErr(input, msg) {
    var f = input.closest('.app-field'), e = $('.app-err', f);
    if (!msg) { f.classList.remove('invalid'); if (e) e.remove(); input.removeAttribute('aria-invalid'); return true; }
    if (!e) { e = document.createElement('small'); e.className = 'app-err'; e.id = input.id + '-err'; f.appendChild(e); }
    e.textContent = msg;
    f.classList.remove('invalid'); void f.offsetWidth; f.classList.add('invalid');
    input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', e.id);
    return false;
  }
  function openNew() {
    formNew.reset();
    $$('.app-field', formNew).forEach(function (f) { f.classList.remove('invalid'); var e = $('.app-err', f); if (e) e.remove(); });
    $$('input', formNew).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    $('#n-addr').setAttribute('aria-describedby', 'n-addr-h');
    updEstimate();
    openDlg(dlgNew);
    setTimeout(function () { $('#n-addr').focus(); }, 30);
  }
  function updEstimate() {
    var p = parseAddr($('#n-addr').value), out = $('[data-estimate]');
    if (!p) { out.textContent = ''; return; }
    var hub = +formNew.elements.hub.value;
    var sec = estimate(hub, addrLoc(p.geo, p.no));
    out.innerHTML = icon('clock') + esc(t('n.estimate', { m: Math.max(4, Math.round(sec / 60)) }));
  }
  ICONS.clock = '<svg ' + SVG_ATTR + ' width="14" height="14"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  formNew.addEventListener('input', function (e) {
    if (e.target.name === 'addr' || e.target.name === 'hub') updEstimate();
    if (e.target.closest('.app-field.invalid')) fieldErr(e.target, null);
  });
  formNew.addEventListener('submit', function (e) {
    e.preventDefault();
    var F = formNew.elements, ok = true;
    var a = parseAddr(F.addr.value);
    ok = fieldErr(F.addr, !F.addr.value.trim() ? t('e.req') : !a ? t('e.addr') : null) && ok;
    ok = fieldErr(F.name, F.name.value.trim().length < 2 ? t('e.req') : null) && ok;
    var digits = F.phone.value.replace(/\D/g, '');
    ok = fieldErr(F.phone, !F.phone.value.trim() ? t('e.req') : (digits.length < 7 || !/^\+?[\d\s()-]+$/.test(F.phone.value.trim())) ? t('e.phone') : null) && ok;
    if (!ok) { var bad = $('[aria-invalid="true"]', formNew); if (bad) bad.focus(); return; }
    var d = createDelivery({
      a: a, fl: F.floor.value.trim(), hub: +F.hub.value, size: F.size.value, prio: F.prio.value,
      name: F.name.value.trim(), phone: F.phone.value.trim(), note: F.note.value.trim(), src: 'manual'
    });
    closeDlg(dlgNew);
    toast(t('toast.created', { id: d.id }));
    save();
    refresh();
  });

  // ---------------------------------------------------------------- detail drawer
  var dlgDetail = $('#dlg-detail'), detailBox = $('[data-detail]');
  function progressOf(d) {
    if (d.st === 'done') return 100;
    if (d.st === 'cancelled' || d.st === 'queued') return 0;
    var r = d.r != null ? state.robots[d.r] : null;
    var f = r && r.pl ? clamp(r.pd / r.pl, 0, 1) : (r && !r.path ? 1 : 0);
    return d.st === 'assigned' ? 5 + f * 35 : 45 + f * 50;
  }
  function openDetail(id) {
    var d = findDel(id);
    if (!d) return;
    ui.detail = id;
    detailBox.dataset.s = '';
    updateDetail(true);
    openDlg(dlgDetail);
  }
  function updateDetail() {
    var d = findDel(ui.detail);
    if (!d) return;
    var sig = d.st + d.r;
    var bar = $('.app-progress i', detailBox);
    if (detailBox.dataset.s === sig) {
      if (bar) { bar.style.width = progressOf(d) + '%'; }
      var eta = $('[data-f="eta"]', detailBox); if (eta) eta.textContent = d.st === 'done' ? mmss((d.td - d.tc) / 1000) : '~' + hhmm(d.eta);
      return;
    }
    detailBox.dataset.s = sig;
    var r = d.r != null ? state.robots[d.r] : null;
    var steps = [
      { k: 'created', txt: t('t.created'), at: d.tc, done: true },
      d.st === 'queued' ? { txt: t('t.queued'), now: true } : { txt: t('t.assigned', { r: r ? r.id : '—' }), at: d.ta, done: !!d.ta },
      { txt: t('t.picked', { hub: hubName(d.hub).split(' · ')[0] }), at: d.tp, done: !!d.tp },
      d.st === 'cancelled' ? { txt: t('t.cancelled'), at: d.tx, bad: true } : { txt: t('t.done'), at: d.td, done: !!d.td }
    ];
    var nowIdx = -1;
    if (d.st === 'assigned') nowIdx = 2; else if (d.st === 'route') nowIdx = 3;
    var late = d.st === 'done' && d.promise && d.td > d.promise;
    detailBox.innerHTML =
      '<div class="app-drawer-h"><div><h2 id="dlg-d-t">' + esc(t('dt.title', { id: d.id })) + '</h2><p>' + esc(addrText(d)) + '</p></div>' +
      '<div class="app-head-actions">' + delBadge(d) + '<button class="app-icon-btn" type="button" data-close aria-label="' + esc(t('close')) + '">' + icon('x') + '</button></div></div>' +
      '<div class="app-drawer-b">' +
      (d.st !== 'cancelled' ? '<div><p class="app-sec-h">' + esc(t('dt.progress')) + '</p><div class="app-progress"><i class="' + (d.st === 'done' ? 'done' : '') + '"></i></div></div>' : '') +
      '<dl class="app-dl">' +
      '<div><dt>' + esc(t('dt.recipient')) + '</dt><dd>' + esc(d.name) + '<br><span class="muted">' + esc(d.phone) + '</span></dd></div>' +
      '<div><dt>' + esc(t('dt.pin')) + '</dt><dd class="pin">' + esc(d.pin) + '</dd></div>' +
      '<div><dt>' + esc(t('dt.robot')) + '</dt><dd>' + (r ? r.id : '—') + '</dd></div>' +
      '<div><dt>' + esc(d.st === 'done' ? t('dt.trip') : t('dt.eta')) + '</dt><dd><span data-f="eta">' + (d.st === 'done' ? mmss((d.td - d.tc) / 1000) : d.st === 'cancelled' ? '—' : '~' + hhmm(d.eta)) + '</span>' +
      (d.st === 'done' ? ' <span class="badge badge--' + (late ? 'warn' : 'ok') + '">' + esc(late ? t('dt.late') : t('dt.ontime')) + '</span>' : '') + '</dd></div>' +
      '<div><dt>' + esc(t('dt.hub')) + '</dt><dd>' + esc(hubName(d.hub)) + '</dd></div>' +
      '<div><dt>' + esc(t('dt.size')) + ' · ' + esc(t('dt.prio')) + '</dt><dd>' + esc(t('size.' + d.size)) + ' · ' + esc(t('prio.' + d.prio)) + '</dd></div>' +
      '<div><dt>' + esc(t('dt.source')) + '</dt><dd>' + esc(t('src.' + (d.src || 'manual'))) + '</dd></div>' +
      (d.note ? '<div><dt>' + esc(t('dt.note')) + '</dt><dd>' + esc(d.note) + '</dd></div>' : '') +
      '</dl>' +
      '<div><p class="app-sec-h">' + esc(t('dt.timeline')) + '</p><ol class="app-timeline">' + steps.map(function (s, i) {
        var cls = s.bad ? 'bad' : s.done ? 'done' : i === nowIdx || s.now ? 'now' : '';
        return '<li class="' + cls + '"><span class="dot">' + (s.bad ? icon('x') : icon('check')) + '</span><span>' + esc(s.txt) + '</span><time>' + (s.at ? hhmm(s.at) : '') + '</time></li>';
      }).join('') + '</ol></div>' +
      '</div>' +
      '<div class="app-drawer-f">' +
      (r && isActive(d) ? '<button class="app-btn app-btn--ghost app-btn--sm" type="button" data-act="locate" data-r="' + d.r + '">' + icon('map') + esc(t('dt.locate')) + '</button>' : '') +
      '<button class="app-btn app-btn--ghost app-btn--sm" type="button" data-act="copy-track">' + icon('link') + esc(t('dt.copy')) + '</button>' +
      (isActive(d) ? '<button class="app-btn app-btn--danger app-btn--sm" type="button" data-act="cancel-del">' + esc(t('dt.cancel')) + '</button>' : '') +
      '</div>';
    bar = $('.app-progress i', detailBox);
    if (bar) { bar.style.width = '0%'; requestAnimationFrame(function () { bar.style.width = progressOf(d) + '%'; }); }
  }

  // ---------------------------------------------------------------- search
  var qIn = $('#app-q'), qList = $('#app-q-list'), qItems = [], qIdx = -1;
  function runSearch() {
    var q = norm(qIn.value);
    if (!q) { togglePop(qList, null, false); qIn.setAttribute('aria-expanded', 'false'); return; }
    var dels = state.deliveries.filter(function (d) { return norm('#' + d.id + ' ' + addrText(d) + ' ' + d.name).indexOf(q) !== -1; }).slice(-6).reverse();
    var robs = state.robots.map(function (r, i) { return { r: r, i: i }; }).filter(function (o) { return norm(o.r.id).indexOf(q) !== -1 || norm(o.r.id.replace('-', '')).indexOf(q) !== -1; }).slice(0, 4);
    qItems = [];
    var html = '';
    if (dels.length) {
      html += '<h3>' + esc(t('search.deliveries')) + '</h3>';
      dels.forEach(function (d) { qItems.push({ d: d.id }); html += '<button class="app-q-item" type="button" role="option" id="qi-' + (qItems.length - 1) + '" data-qi="' + (qItems.length - 1) + '"><span class="id">#' + d.id + '</span><span class="addr">' + esc(addrText(d)) + '</span>' + delBadge(d) + '</button>'; });
    }
    if (robs.length) {
      html += '<h3>' + esc(t('search.robots')) + '</h3>';
      robs.forEach(function (o) { qItems.push({ r: o.i }); html += '<button class="app-q-item" type="button" role="option" id="qi-' + (qItems.length - 1) + '" data-qi="' + (qItems.length - 1) + '"><span class="id">' + o.r.id + '</span><span class="addr">' + esc(robotTask(o.r)) + '</span>' + robotBadge(o.r) + '</button>'; });
    }
    if (!qItems.length) html = '<p class="app-q-empty">' + esc(t('search.empty')) + '</p>';
    qList.innerHTML = html;
    qIdx = -1;
    togglePop(qList, null, true);
    qIn.setAttribute('aria-expanded', 'true');
  }
  function qChoose(i) {
    var it = qItems[i];
    if (!it) return;
    qIn.value = ''; togglePop(qList, null, false); qIn.setAttribute('aria-expanded', 'false'); qIn.blur();
    if (it.d != null) openDetail(it.d);
    else { if (ui.view !== 'fleet') location.hash = '#fleet'; setTimeout(function () { selectRobot(it.r, true); }, 60); }
  }
  qIn.addEventListener('input', runSearch);
  qIn.addEventListener('focus', function () { if (qIn.value) runSearch(); });
  qIn.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!qItems.length) return;
      qIdx = (qIdx + (e.key === 'ArrowDown' ? 1 : -1) + qItems.length) % qItems.length;
      $$('.app-q-item', qList).forEach(function (b, i) { b.setAttribute('aria-selected', String(i === qIdx)); });
      qIn.setAttribute('aria-activedescendant', 'qi-' + qIdx);
    } else if (e.key === 'Enter') { e.preventDefault(); qChoose(qIdx < 0 ? 0 : qIdx); }
    else if (e.key === 'Escape') { qIn.value = ''; togglePop(qList, null, false); qIn.blur(); }
  });
  qList.addEventListener('mousedown', function (e) { e.preventDefault(); });
  qList.addEventListener('click', function (e) { var b = e.target.closest('[data-qi]'); if (b) qChoose(+b.dataset.qi); });
  qIn.addEventListener('blur', function () { setTimeout(function () { togglePop(qList, null, false); qIn.setAttribute('aria-expanded', 'false'); }, 120); });

  // ---------------------------------------------------------------- clipboard & files
  function copy(text, msg) {
    var done = function () { toast(msg); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove();
  }
  function download(name, text) {
    var url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCsv() {
    var rows = [[t('col.id'), t('col.addr'), t('col.recipient'), t('n.phone'), t('col.robot'), t('col.status'), t('col.created'), t('col.eta'), t('dt.source')]];
    filteredDeliveries().forEach(function (d) {
      rows.push([d.id, addrText(d), d.name, d.phone, d.r != null ? state.robots[d.r].id : '', t('s.' + d.st), hhmm(d.tc), etaCell(d), t('src.' + (d.src || 'manual'))]);
    });
    download('deliveries-' + state.day + '.csv', rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'));
  }
  function importCsv(text) {
    var lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); }), n = 0;
    lines.forEach(function (line, i) {
      var cols = line.split(/[;,](?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (c) { return c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'); });
      if (i === 0 && /addr|adres|direcci/i.test(cols[0])) return;
      var a = parseAddr(cols[0]);
      if (!a || n >= 30) return;
      createDelivery({ a: a, hub: 0, size: 'm', prio: 'std', name: cols[1] || randName(), phone: cols[2] || randPhone(), src: 'csv' });
      n++;
    });
    toast(n ? t('i.csv_done', { n: n }) : t('i.csv_none'));
    save(); refresh();
  }

  // ---------------------------------------------------------------- integrations toggles
  function toggleInteg(id) {
    var it = state.integ[id];
    if (ui.busy) return;
    if (it.on) { it.on = false; rerender(); save(); return; }
    ui.busy = id; rerender();
    setTimeout(function () { ui.busy = null; it.on = true; rerender(); save(); toast(t('i.' + id) + ' · ' + t('i.connected')); }, reduceMotion ? 50 : 1200);
  }
  function rerender() { if (view === VIEWS.integrations) { var y = window.scrollY; view.render(viewEl); window.scrollTo(0, y); } }

  // ---------------------------------------------------------------- global events
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act],[data-open],[data-filter],[data-sort] button,[data-robot],[data-toggle],[data-remove],[data-close],[data-speed]');
    if (!el) {
      if (!notifPop.hidden && !e.target.closest('.app-notif')) togglePop(notifPop, notifBtn, false);
      return;
    }
    if (el.matches('[data-close]')) { closeDlg(el.closest('dialog')); return; }
    if (el.dataset.open) { openDetail(+el.dataset.open); return; }
    if (el.dataset.filter) { ui.dl.f = el.dataset.filter; ui.dl.limit = 25; $$('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); }); view.first = true; refresh(); return; }
    if (el.closest('[data-sort]')) {
      var k = el.closest('[data-sort]').dataset.sort;
      if (ui.dl.sort === k) ui.dl.dir *= -1; else { ui.dl.sort = k; ui.dl.dir = -1; }
      refresh(); return;
    }
    if (el.dataset.speed) { state.sim.speed = +el.dataset.speed; syncSim(); save(); return; }
    if (el.dataset.toggle) { toggleInteg(el.dataset.toggle); return; }
    if (el.dataset.robot) {
      var i = +el.closest('.app-robot').dataset.k, r = state.robots[i], a = el.dataset.robot;
      e.stopPropagation();
      if (a === 'pause') { r.prev = r.st; r.st = 'paused'; }
      else if (a === 'resume') { r.st = r.prev || 'idle'; r.prev = null; }
      else if (a === 'charge') {
        r.lowEv = true;
        if (!r.path && dist(r, HUBS[r.hub]) < 1) r.st = 'charging';
        else { r.st = 'return'; setRoute(r, nearestHub(r)); }
      } else if (a === 'online') { r.st = 'idle'; r.battery = 100; r.loc = HUBS[r.hub]; r.x = r.loc.x; r.y = r.loc.y; r.path = null; }
      save(); refresh(); return;
    }
    if (el.dataset.remove) {
      var m = state.team.filter(function (x) { return x.id === +el.dataset.remove; })[0];
      if (!m) return;
      confirmDlg(t('tm.remove_confirm', { n: m.name }), t('tm.remove')).then(function (yes) {
        if (!yes) return;
        var row = el.closest('tr');
        var finish = function () { state.team = state.team.filter(function (x) { return x !== m; }); save(); refresh(); toast(t('toast.removed', { n: m.name })); };
        if (row && !reduceMotion) { row.classList.add('is-out'); setTimeout(finish, 380); } else finish();
      });
      return;
    }
    switch (el.dataset.act) {
      case 'new': openNew(); break;
      case 'invite': openInvite(); break;
      case 'more': ui.dl.limit += 25; refresh(); break;
      case 'export': exportCsv(); break;
      case 'notif': togglePop(notifPop, notifBtn); renderNotifs(); break;
      case 'notif-read': state.events.forEach(function (x) { x.r = true; }); renderNotifs(); save(); break;
      case 'sim-toggle': state.sim.on = !state.sim.on; syncSim(); save(); break;
      case 'reset':
        confirmDlg(t('sim.reset_confirm'), t('sim.reset')).then(function (yes) {
          if (!yes) return;
          try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
          boot(true); toast(t('toast.reset'));
        });
        break;
      case 'cancel-del':
        var d = findDel(ui.detail);
        if (d) { cancelDelivery(d); toast(t('toast.cancelled', { id: d.id })); save(); refresh(); }
        break;
      case 'copy-track':
        var dd = findDel(ui.detail);
        if (dd) copy('https://app.deliverynextgen.eu/t/' + dd.id + '-' + dd.pin.split('').reverse().join(''), t('dt.copied'));
        break;
      case 'locate':
        var ri = +el.dataset.r;
        closeDlg(dlgDetail);
        if (ui.view !== 'fleet') location.hash = '#fleet';
        setTimeout(function () { selectRobot(ri); var mp = $('[data-map]'); if (mp) mp.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); }, 260);
        break;
      case 'key-show': ui.apiShow = !ui.apiShow; rerender(); break;
      case 'key-copy': copy(state.integ.api.key, t('i.copied')); break;
      case 'key-regen':
        confirmDlg(t('i.regen') + '?', t('i.regen')).then(function (yes) {
          if (!yes) return;
          state.integ.api.key = randKey(); save(); rerender();
          var c = $('[data-key]'); if (c) c.classList.add('swap');
          toast(t('i.regen_done'));
        });
        break;
      case 'hook-test':
        if (!state.integ.hooks.on || !state.integ.hooks.url) { toggleInteg('hooks'); break; }
        state.hookLog.unshift({ t: state.clock, ev: 'test.ping', id: '', ms: rint(60, 140), code: 200 });
        refresh(); save(); break;
      case 'csv-sample':
        var s = STREETS;
        download('deliveries-sample.csv', 'address,recipient,phone\n' + [s[1] + ' 12', s[4] + ' 7', s[2] + ' 33'].map(function (a) { return csvCell(a) + ',' + csvCell(randName()) + ',' + csvCell(randPhone()); }).join('\n'));
        break;
    }
  });
  // robot card click → select on map
  document.addEventListener('click', function (e) {
    var c = e.target.closest('.app-robot');
    if (!c || e.target.closest('button')) return;
    var i = +c.dataset.k;
    selectRobot(ui.sel === i ? null : i);
    if (ui.sel != null) { var mp = $('[data-map]'); if (mp && mp.getBoundingClientRect().top < 0) mp.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' }); }
  });
  document.addEventListener('keydown', function (e) {
    var tgt = e.target;
    if (tgt.matches && tgt.matches('tr[data-open], .app-robot') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tgt.click(); return; }
    var typing = tgt.matches && tgt.matches('input, textarea, select');
    if (typing || document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); qIn.focus(); }
    else if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openNew(); }
    else if (e.key === 'Escape') { togglePop(notifPop, notifBtn, false); selectRobot(null); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.matches('[data-dl-q]')) { ui.dl.q = e.target.value; ui.dl.limit = 25; refresh(); }
  });
  document.addEventListener('change', function (e) {
    var s = e.target;
    if (s.matches('[data-role]')) {
      var m = state.team.filter(function (x) { return x.id === +s.dataset.role; })[0];
      if (m) { m.role = s.value; save(); refresh(); toast(t('toast.role', { n: m.name, r: t('role.' + m.role) })); }
    }
    if (s.matches('[data-csv]') && s.files && s.files[0]) readCsv(s.files[0]);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-form="hook"]')) {
      e.preventDefault();
      var inp = $('input', f), err = $('[data-err]', f), v = inp.value.trim();
      if (!/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v)) { err.textContent = t('i.url_err'); err.hidden = false; inp.setAttribute('aria-invalid', 'true'); return; }
      err.hidden = true; inp.removeAttribute('aria-invalid');
      state.integ.hooks.url = v; save(); toast(t('i.saved'));
    }
  });
  function readCsv(file) { var rd = new FileReader(); rd.onload = function () { importCsv(String(rd.result)); }; rd.readAsText(file); }
  ['dragenter', 'dragover'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { var d = e.target.closest && e.target.closest('[data-drop]'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var d = e.target.closest && e.target.closest('[data-drop]');
      if (!d) return;
      e.preventDefault(); d.classList.remove('over');
      if (ev === 'drop' && e.dataTransfer.files[0]) readCsv(e.dataTransfer.files[0]);
    });
  });
  // keep the current view when switching language
  $$('[data-keep-hash]').forEach(function (a) { a.addEventListener('click', function () { a.href = a.href.split('#')[0] + location.hash; }); });
  window.addEventListener('resize', moveNavInd);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); last = 0; });

  // ---------------------------------------------------------------- invite
  var dlgInv = $('#dlg-invite'), formInv = $('[data-form="invite"]');
  function openInvite() {
    formInv.reset();
    $$('.app-field', formInv).forEach(function (f) { f.classList.remove('invalid'); var e = $('.app-err', f); if (e) e.remove(); });
    openDlg(dlgInv);
    setTimeout(function () { $('#i-name').focus(); }, 30);
  }
  formInv.addEventListener('input', function (e) { if (e.target.closest('.app-field.invalid')) fieldErr(e.target, null); });
  formInv.addEventListener('submit', function (e) {
    e.preventDefault();
    var F = formInv.elements, email = F.email.value.trim().toLowerCase(), ok = true;
    ok = fieldErr(F.name, F.name.value.trim().length < 2 ? t('e.req') : null) && ok;
    var dup = state.team.some(function (m) { return m.email.toLowerCase() === email; });
    ok = fieldErr(F.email, !email ? t('e.req') : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? t('e.email') : dup ? t('e.dup') : null) && ok;
    if (!ok) { var bad = $('[aria-invalid="true"]', formInv); if (bad) bad.focus(); return; }
    state.team.push({ id: state.teamSeq++, name: F.name.value.trim(), email: email, role: F.role.value, st: 'invited', last: null, inv: Date.now() });
    closeDlg(dlgInv);
    toast(t('toast.invited', { e: email }));
    save(); refresh();
  });

  // ---------------------------------------------------------------- simulation controls
  function syncSim() {
    document.body.classList.toggle('sim-off', !state.sim.on);
    var b = $('[data-act="sim-toggle"]');
    b.setAttribute('aria-pressed', String(!state.sim.on));
    $('.app-sim-label', b).textContent = state.sim.on ? t('sim.pause') : t('sim.play');
    $$('[data-speed]').forEach(function (x) { x.setAttribute('aria-checked', String(+x.dataset.speed === state.sim.speed)); });
  }

  // ---------------------------------------------------------------- boot
  function warmUp() {
    // Run the fleet for a few simulated minutes so the demo opens mid-shift.
    silent = true;
    var spawnEvery = 9, acc = 0, seq0 = state.seq;
    for (var s = 0; s < 150; s += 0.2) {
      acc += 0.2;
      if (acc >= spawnEvery) { acc = 0; spawnAuto(); }
      tick(0.2);
    }
    silent = false;
    // keep today's totals realistic: warm-up orders replace part of the seeded history
    var extra = state.seq - seq0, S = state.stats;
    for (var h = hourOf(state.clock); h >= 0 && extra > 0; h--) {
      var take = Math.min(extra, Math.max(0, S.hours[h] - (h === hourOf(state.clock) ? 0 : 4)));
      S.hours[h] -= take; S.today -= take; S.done = Math.max(0, S.done - take); S.onTime = Math.min(S.onTime, S.done);
      extra -= take;
    }
    S.onTime = Math.round(S.done * rnd(0.968, 0.982));
  }
  function boot(reset) {
    var s = reset ? null : load();
    if (s) { state = s; }
    else {
      state = fresh();
      var simOn = true;
      warmUp();
      state.sim.on = simOn;
    }
    // localised addresses and names come from the language that created the data;
    // street names are stored as indexes so switching language re-labels them.
    ui.sel = null; ui.detail = null; ui.arrived = {};
    syncSim();
    renderNotifs();
    route_();
    refresh();
    save();
  }

  boot(false);
  requestAnimationFrame(function () { document.body.classList.remove('is-loading'); moveNavInd(); });
  requestAnimationFrame(frame);
})();
