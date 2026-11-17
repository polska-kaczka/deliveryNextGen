/* ==========================================================================
   DeliveryNextGen — demo-day presentation engine (no dependencies, CSP-safe)
   - 1920×1080 stage scaled to the screen
   - one pausable clock drives every scripted animation (scene time `t`)
   - CSS handles entrances (.is-on) and is paused together with the clock
   - speaker notes in a second window (?notes) synced via BroadcastChannel
   ========================================================================== */
(function () {
  'use strict';

  var S = {};
  try { S = JSON.parse(document.getElementById('present-i18n').textContent); } catch (e) { S = {}; }
  var params = new URLSearchParams(location.search);
  var CH = null;
  try { CH = new BroadcastChannel('dng-present'); } catch (e) { CH = null; }
  function send(msg) { if (CH) { try { CH.postMessage(msg); } catch (e) { /* ignore */ } } }

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var ease = {
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    outExpo: function (p) { return p === 1 ? 1 : 1 - Math.pow(2, -10 * p); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    lin: function (p) { return p; }
  };
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Polyline helpers: build once, then sample by distance.
  function poly(pts) {
    var lens = [], total = 0;
    for (var i = 1; i < pts.length; i++) {
      var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l); total += l;
    }
    return { pts: pts, lens: lens, total: total };
  }
  function at(P, d) {
    d = clamp(d, 0, P.total);
    for (var i = 0; i < P.lens.length; i++) {
      if (d <= P.lens[i] || i === P.lens.length - 1) {
        var a = P.pts[i], b = P.pts[i + 1], k = P.lens[i] ? d / P.lens[i] : 0;
        return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k };
      }
      d -= P.lens[i];
    }
    return { x: P.pts[0][0], y: P.pts[0][1] };
  }
  function heading(P, d, look) {
    var a = at(P, d - look), b = at(P, d + look);
    return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  var chapters = [];
  for (var c = 1; S['ch.' + c]; c++) chapters.push(S['ch.' + c]);

  if (params.has('notes')) { notesMode(); return; }

  // ------------------------------------------------------------------------
  // Stage setup
  // ------------------------------------------------------------------------
  var body = document.body;
  var stage = $('#stage');
  var scenes = $$('.ps', stage);
  var N = scenes.length;

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  // entrance delays and text splitting
  $$('[data-d]').forEach(function (el) { el.style.setProperty('--d', (+el.getAttribute('data-d') || 0) + 'ms'); });
  $$('[data-split]').forEach(function (el) {
    var base = +el.getAttribute('data-d') || 0;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var s = document.createElement('span');
      s.className = 'w'; s.textContent = w;
      s.style.setProperty('--d', (base + i * 70) + 'ms');
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.setAttribute('aria-label', words.join(' '));
  });
  $$('[data-chars]').forEach(function (el) {
    var base = +el.getAttribute('data-d') || 0;
    var text = el.textContent.trim();
    el.textContent = '';
    text.split('').forEach(function (ch, i) {
      var s = document.createElement('span');
      s.className = 'c'; s.textContent = ch;
      s.style.setProperty('--d', (base + i * 38) + 'ms');
      el.appendChild(s);
    });
    el.setAttribute('aria-label', text);
  });

  // HUD
  var bar = $('[data-bar]');
  var segs = scenes.map(function () { var s = document.createElement('span'); s.appendChild(document.createElement('b')); bar.appendChild(s); return s; });
  $('[data-hud-total]').textContent = pad2(N);
  var hudNum = $('[data-hud-num]'), hudCh = $('[data-hud-ch]');

  // ------------------------------------------------------------------------
  // Clock & scene control
  // ------------------------------------------------------------------------
  var cur = -1, t = 0, playing = false, loop = params.has('loop');
  var events = [], ticks = [], last = 0, startedAt = 0, lastSent = 0;

  function api() {
    return {
      at: function (ms, fn) { events.push({ ms: ms, fn: fn, done: false }); },
      tick: function (fn) { ticks.push(fn); },
      tween: function (start, dur, fn, ez) {
        var done = false; ez = ez || ease.out;
        ticks.push(function (now) {
          if (done || now < start) return;
          var p = clamp((now - start) / dur, 0, 1);
          fn(ez(p), p);
          if (p >= 1) done = true;
        });
      }
    };
  }

  function go(i) {
    if (loop) i = (i + N) % N; else i = clamp(i, 0, N - 1);
    var old = scenes[cur];
    if (old && old !== scenes[i]) {
      old.classList.remove('is-on');
      old.classList.add('is-out');
      setTimeout(function () { old.classList.remove('is-out'); }, 900);
    }
    cur = i; t = 0; events = []; ticks = [];
    var el = scenes[i];
    el.classList.remove('is-out', 'is-on');
    void el.offsetWidth; // restart CSS animations
    el.classList.add('is-on');
    stage.setAttribute('data-scene', el.getAttribute('data-key'));
    var fn = SCENES[el.getAttribute('data-key')];
    if (fn) fn(el, api());
    segs.forEach(function (s, j) { s.classList.toggle('is-done', j < i); s.firstChild.style.width = j < i ? '100%' : '0'; });
    hudNum.textContent = pad2(i + 1);
    hudCh.textContent = chapters[i] || '';
    hudCh.classList.remove('is-swap'); void hudCh.offsetWidth; hudCh.classList.add('is-swap');
    broadcast(true);
  }

  function frame(now) {
    var dt = last ? Math.min(100, now - last) : 0;
    last = now;
    if (playing && cur >= 0) {
      t += dt;
      for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        if (!ev.done && t >= ev.ms) { ev.done = true; ev.fn(); }
      }
      for (var j = 0; j < ticks.length; j++) ticks[j](t, dt);
      var dur = +scenes[cur].getAttribute('data-dur') || 8000;
      segs[cur].firstChild.style.width = Math.min(100, t / dur * 100) + '%';
      if (t >= dur) {
        if (cur < N - 1) go(cur + 1);
        else if (loop) go(0);
      }
      if (now - lastSent > 400) broadcast();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function setPlaying(p) {
    playing = p;
    stage.classList.toggle('is-paused', !p);
    body.classList.toggle('is-paused', !p);
    var b = $('[data-cmd="toggle"]');
    var label = p ? S['ui.pause'] : S['ui.play'];
    b.setAttribute('aria-label', label); b.title = label;
    broadcast(true);
  }
  function setLoop(v) {
    loop = v;
    $('[data-cmd="loop"]').setAttribute('aria-pressed', String(v));
    var cb = $('[data-loop]'); if (cb) cb.checked = v;
  }

  function broadcast(force) {
    if (cur < 0 && !force) return;
    lastSent = performance.now();
    send({
      type: 'state', i: cur, n: N, t: t, playing: playing,
      dur: cur >= 0 ? +scenes[cur].getAttribute('data-dur') : 0,
      elapsed: startedAt ? performance.now() - startedAt : 0
    });
  }

  // ------------------------------------------------------------------------
  // Scene scripts — each one resets its own DOM, then schedules on the clock
  // ------------------------------------------------------------------------
  var SCENES = {};

  // ---- 5 · One delivery -------------------------------------------------
  SCENES.story = function (el, A) {
    var q = function (s) { return $(s, el); };
    var plan = q('.pm-plan'), p1 = q('.pm-p1'), p2 = q('.pm-p2');
    var obst = q('.pm-obst'), bot = q('.pm-bot'), origin = q('.pm-origin'), dest = q('.pm-dest');
    var steps = $$('.step', el), clock = q('[data-clock]'), status = q('[data-status]');
    var etaBox = q('.ph-eta'), toast = q('[data-toast]'), pin = q('.ph-pin'), ok = q('.ph-ok');
    var dots = $$('.ph-dots i', el), keys = $$('.ph-keys b', el);
    var statuses = (S['story.statuses'] || '').split('|');
    var P1 = poly([[70, 700], [70, 520], [210, 520]]);
    var P2 = poly([[210, 520], [330, 520], [330, 330]]);

    function prep(path) {
      var L = path.getTotalLength();
      path.style.stroke = ''; path.style.opacity = '0';
      path.style.strokeDasharray = L + ' ' + L; path.style.strokeDashoffset = L;
      return L;
    }
    var Lplan = prep(plan), L1 = prep(p1), L2 = prep(p2);
    obst.style.opacity = '0'; bot.style.opacity = '0'; origin.style.opacity = '0'; dest.style.opacity = '0';
    steps.forEach(function (s) { s.classList.remove('is-active', 'is-done'); });
    clock.textContent = '21:47';
    status.textContent = statuses[0] || '';
    etaBox.textContent = '';
    var etaLbl = document.createElement('span'); etaLbl.textContent = S['story.s.eta'];
    var etaNum = document.createElement('b'); etaNum.textContent = '16';
    var etaMin = document.createElement('span'); etaMin.textContent = S['story.s.min'];
    etaBox.appendChild(etaLbl); etaBox.appendChild(document.createTextNode(' '));
    etaBox.appendChild(etaNum); etaBox.appendChild(document.createTextNode(' '));
    etaBox.appendChild(etaMin);
    toast.classList.remove('is-on'); pin.classList.remove('is-on'); ok.classList.remove('is-on');
    dots.forEach(function (d) { d.classList.remove('is-on'); });
    keys.forEach(function (k) { k.classList.remove('is-press'); });
    function place(P, p) { var pt = at(P, P.total * p); bot.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')'); }
    place(P1, 0);

    function setStep(i, dur) {
      steps.forEach(function (s, j) {
        s.classList.toggle('is-active', j === i);
        s.classList.toggle('is-done', j < i);
      });
      steps[i].style.setProperty('--step-dur', dur + 'ms');
      status.textContent = statuses[i] || '';
      status.classList.remove('is-swap'); void status.offsetWidth; status.classList.add('is-swap');
    }

    A.at(0, function () { setStep(0, 3200); });
    A.at(1500, function () { origin.style.opacity = '1'; });
    A.at(1800, function () { dest.style.opacity = '1'; });
    A.tween(2000, 1300, function (p) {
      p1.style.opacity = '1'; plan.style.opacity = '1';
      p1.style.strokeDashoffset = L1 * (1 - Math.min(1, p * 1.9));
      plan.style.strokeDashoffset = Lplan * (1 - Math.max(0, p * 1.9 - 0.9));
    }, ease.lin);
    A.at(3200, function () { setStep(1, 2200); bot.style.opacity = '1'; });
    A.tween(4400, 3000, function (p) { place(P1, p); }, ease.inOut);
    A.at(5400, function () { setStep(2, 7300); });
    A.at(6100, function () { obst.style.opacity = '1'; toast.classList.add('is-on'); });
    A.at(6900, function () {
      plan.style.stroke = '#9aa4ae'; plan.style.strokeDasharray = '2 12'; plan.style.strokeDashoffset = '0'; plan.style.opacity = '0.8';
    });
    A.tween(6900, 900, function (p) { p2.style.opacity = '1'; p2.style.strokeDashoffset = L2 * (1 - p); });
    A.tween(7400, 5200, function (p) { place(P2, p); }, ease.inOut);
    A.at(8800, function () { toast.classList.remove('is-on'); });
    A.tween(0, 12600, function (p) {
      var mins = 47 + Math.round(16 * p);
      clock.textContent = (21 + Math.floor(mins / 60)) + ':' + pad2(mins % 60);
      etaNum.textContent = String(Math.max(1, Math.ceil(16 * (1 - p))));
    }, ease.lin);
    A.at(12700, function () {
      setStep(3, 5200);
      etaBox.textContent = S['story.arrived'] || '';
      clock.textContent = '22:03';
    });
    A.at(13300, function () { pin.classList.add('is-on'); });
    '4821'.split('').forEach(function (digit, i) {
      var key = keys.filter(function (k) { return k.textContent === digit; })[0];
      A.at(14100 + i * 420, function () {
        if (key) { key.classList.add('is-press'); setTimeout(function () { key.classList.remove('is-press'); }, 220); }
        dots[i].classList.add('is-on');
      });
    });
    A.at(16000, function () { ok.classList.add('is-on'); steps[3].classList.add('is-done'); });
  };

  // ---- 6 · Platform -----------------------------------------------------
  SCENES.platform = function (el, A) {
    var nav = $('[data-nav]', el);
    nav.textContent = '';
    (S['platform.nav'] || '').split('|').forEach(function (name, i) {
      var li = document.createElement('li');
      li.textContent = name;
      if (i === 0) li.className = 'is-cur';
      li.style.animationDelay = (1000 + i * 90) + 'ms';
      nav.appendChild(li);
    });

    var K = {};
    $$('[data-kpi]', el).forEach(function (b) { K[b.getAttribute('data-kpi')] = b; b.textContent = '0'; });
    var vals = { active: 23, bots: 11, avg: 14, done: 318 };
    A.tween(1600, 1700, function (p) {
      K.active.textContent = Math.round(vals.active * p);
      K.bots.textContent = Math.round(vals.bots * p);
      K.avg.textContent = Math.round(vals.avg * p);
      K.done.textContent = Math.round(vals.done * p);
    }, ease.outExpo);

    var spark = $('[data-spark]', el);
    var series = [8, 11, 9, 13, 12, 16, 15, 19];
    function drawSpark() {
      var max = Math.max.apply(null, series), min = Math.min.apply(null, series);
      spark.setAttribute('d', series.map(function (v, i) {
        return (i ? 'L' : 'M') + (i * (120 / (series.length - 1))).toFixed(1) + ' ' + (32 - (v - min) / ((max - min) || 1) * 26).toFixed(1);
      }).join(' '));
    }
    drawSpark();

    // fleet: robots looping on the street grid
    var group = $('[data-bots]', el);
    group.textContent = '';
    var X = [60, 220, 380, 540, 700], Y = [60, 175, 295, 410];
    var routes = [
      [[X[0], Y[0]], [X[2], Y[0]], [X[2], Y[2]], [X[0], Y[2]], [X[0], Y[0]]],
      [[X[1], Y[1]], [X[4], Y[1]], [X[4], Y[3]], [X[1], Y[3]], [X[1], Y[1]]],
      [[X[2], Y[0]], [X[4], Y[0]], [X[4], Y[2]], [X[2], Y[2]], [X[2], Y[0]]],
      [[X[0], Y[1]], [X[3], Y[1]], [X[3], Y[3]], [X[0], Y[3]], [X[0], Y[1]]],
      [[X[1], Y[0]], [X[1], Y[3]], [X[3], Y[3]], [X[3], Y[0]], [X[1], Y[0]]],
      [[X[3], Y[2]], [X[4], Y[2]], [X[4], Y[0]], [X[3], Y[0]], [X[3], Y[2]]],
      [[X[0], Y[3]], [X[2], Y[3]], [X[2], Y[1]], [X[0], Y[1]], [X[0], Y[3]]],
      [[X[2], Y[1]], [X[3], Y[1]], [X[3], Y[2]], [X[2], Y[2]], [X[2], Y[1]]]
    ];
    var bots = routes.map(function (pts, i) {
      var P = poly(pts);
      var g = svgEl('g', { 'class': 'fm-bot' }, group);
      var col = i === 5 ? '#ff9f0a' : '#00d4f0';
      svgEl('circle', { 'class': 'halo', r: 10, fill: col, 'fill-opacity': 0.35 }, g);
      svgEl('circle', { r: 7.5, fill: col, stroke: '#0f151b', 'stroke-width': 3 }, g);
      g.style.opacity = '0';
      return { g: g, P: P, off: (i * 173) % P.total, v: 0.06 + (i % 3) * 0.018 };
    });
    // two robots charging at the hubs
    [[228, 168], [548, 288]].forEach(function (p) {
      var g = svgEl('g', { 'class': 'fm-bot', transform: 'translate(' + (p[0] + 16) + ' ' + (p[1] - 14) + ')' }, group);
      svgEl('circle', { r: 7, fill: '#34c759', stroke: '#0f151b', 'stroke-width': 3 }, g);
      g.style.opacity = '0';
      bots.push({ g: g, still: true });
    });
    A.at(2300, function () { bots.forEach(function (b, i) { setTimeout(function () { b.g.style.opacity = '1'; }, i * 70); }); });
    A.tick(function (now) {
      bots.forEach(function (b) {
        if (b.still) return;
        var pt = at(b.P, (b.off + now * b.v) % b.P.total);
        b.g.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
      });
    });

    // activity feed
    var feed = $('[data-feed]', el);
    feed.textContent = '';
    var tpl = (S['platform.ev'] || '').split('|');
    var dotCls = ['ok', '', 'dim', '', 'warn', ''];
    var id = 4822, minute = 52;
    function addEvent(n) {
      var k = n % tpl.length;
      var text = tpl[k].replace('{id}', id + n).replace('{m}', 6 + (n * 7) % 11).replace('{r}', pad2(1 + (n * 5) % 14));
      var li = document.createElement('li');
      var dot = document.createElement('i'); if (dotCls[k]) dot.className = dotCls[k];
      var span = document.createElement('span'); span.textContent = text;
      var time = document.createElement('time'); time.textContent = '21:' + pad2((minute + n) % 60);
      li.appendChild(dot); li.appendChild(span); li.appendChild(time);
      feed.insertBefore(li, feed.firstChild);
      while (feed.children.length > 7) feed.removeChild(feed.lastChild);
    }
    for (var n = 0; n < 9; n++) {
      (function (n) {
        A.at(2400 + n * 1150, function () {
          addEvent(n);
          if (n > 1) {
            var target = n % 2 ? K.done : K.active;
            if (target === K.done) { vals.done += 1; K.done.textContent = vals.done; series.push(series[series.length - 1] + (n % 3) - 0.5); series.shift(); drawSpark(); }
            else { vals.active += (n % 4 ? 1 : -1); K.active.textContent = vals.active; }
            target.classList.remove('is-bump'); void target.offsetWidth; target.classList.add('is-bump');
          }
        });
      })(n);
    }
  };

  // ---- 7 · Integrations -------------------------------------------------
  SCENES.int = function (el, A) {
    var pre = $('[data-code]', el), res = $('[data-res]', el), hook = $('[data-hook]', el);
    var tokens = [
      ['tk-m', 'POST '], ['tk-u', '/v1/deliveries\n'], ['tk-p', '{\n'],
      ['tk-k', '  "pickup"'], ['tk-p', ': '], ['tk-s', '"Trattoria Sole"'], ['tk-p', ',\n'],
      ['tk-k', '  "dropoff"'], ['tk-p', ': '], ['tk-s', '"Calle Mayor 12"'], ['tk-p', ',\n'],
      ['tk-k', '  "window"'], ['tk-p', ': '], ['tk-s', '"21:50–22:10"'], ['tk-p', ',\n'],
      ['tk-k', '  "compartment"'], ['tk-p', ': '], ['tk-s', '"insulated"'], ['tk-p', '\n}']
    ];
    var total = tokens.reduce(function (s, x) { return s + x[1].length; }, 0);
    var shown = -1;
    function render(n) {
      if (n === shown) return;
      shown = n; pre.textContent = '';
      var left = n;
      for (var i = 0; i < tokens.length && left > 0; i++) {
        var part = tokens[i][1].slice(0, left);
        left -= part.length;
        var s = document.createElement('span'); s.className = tokens[i][0]; s.textContent = part;
        pre.appendChild(s);
      }
    }
    render(0);
    res.classList.remove('is-on'); hook.classList.remove('is-on');
    A.tween(1400, 3600, function (p) { render(Math.round(total * p)); }, ease.lin);
    A.at(5400, function () { res.classList.add('is-on'); });
    A.at(7200, function () { hook.classList.add('is-on'); });

    // hub
    var lines = $('[data-lines]', el), packets = $('[data-packets]', el);
    var nodes = $$('.hub-node', el), core = $('.hub-pulse', el);
    lines.textContent = ''; packets.textContent = '';
    var C = { x: 450, y: 380 };
    var pos = nodes.map(function (n, i) {
      var a = (-90 + i * 60) * Math.PI / 180;
      return { x: C.x + Math.cos(a) * 340, y: C.y + Math.sin(a) * 300 };
    });
    var lineEls = pos.map(function (p) {
      var l = svgEl('line', { x1: p.x, y1: p.y, x2: C.x, y2: C.y }, lines);
      l.style.opacity = '0';
      return l;
    });
    nodes.forEach(function (n, i) {
      n.classList.remove('is-hit');
      n.style.opacity = '0';
      n.setAttribute('transform', 'translate(' + pos[i].x + ' ' + pos[i].y + ') scale(.6)');
      A.tween(1100 + i * 160, 800, function (p) {
        n.style.opacity = String(Math.min(1, p * 1.4));
        n.setAttribute('transform', 'translate(' + pos[i].x + ' ' + pos[i].y + ') scale(' + (0.6 + 0.4 * p) + ')');
        lineEls[i].style.opacity = String(p);
      }, ease.out);
    });
    var live = [];
    function spawn(k) {
      var i = k % nodes.length, out = k % 3 === 2;
      var c = svgEl('circle', { 'class': 'hub-packet', r: 7 }, packets);
      live.push({ c: c, i: i, out: out, t0: null });
    }
    for (var k = 0; k < 14; k++) { (function (k) { A.at(2200 + k * 520, function () { spawn(k * 5 + 1); }); })(k); }
    A.tick(function (now) {
      live = live.filter(function (pk) {
        if (pk.t0 === null) pk.t0 = now;
        var p = clamp((now - pk.t0) / 900, 0, 1), e = ease.inOut(p);
        var a = pk.out ? C : pos[pk.i], b = pk.out ? pos[pk.i] : C;
        pk.c.setAttribute('cx', a.x + (b.x - a.x) * e);
        pk.c.setAttribute('cy', a.y + (b.y - a.y) * e);
        if (p >= 1) {
          var hit = pk.out ? nodes[pk.i] : core;
          hit.classList.remove('is-hit'); void hit.getBoundingClientRect(); hit.classList.add('is-hit');
          if (pk.out) setTimeout(function () { hit.classList.remove('is-hit'); }, 500);
          pk.c.remove();
          return false;
        }
        return true;
      });
    });
  };

  // ---- 8 · Safety -------------------------------------------------------
  SCENES.safe = function (el, A) {
    var bot = $('[data-bot]', el), trail = $('[data-trail]', el);
    var evs = $$('[data-ev]', el);
    evs.forEach(function (e) { e.classList.remove('is-on'); });
    bot.classList.remove('is-warn', 'is-op');
    var P = poly([[-200, 650], [1040, 650], [1100, 640], [1150, 575], [1200, 560], [1270, 560], [1320, 575], [1370, 640], [1430, 650], [2200, 650]]);
    var dStop = 1240; // stop before the obstacle
    var d = 0;
    function place(dist) {
      d = dist;
      var pt = at(P, dist), ang = heading(P, dist, 40);
      bot.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
      var parts = [], step = 18;
      for (var s = Math.max(0, dist - 900); s <= dist; s += step) { var q = at(P, s); parts.push((parts.length ? 'L' : 'M') + q.x.toFixed(0) + ' ' + q.y.toFixed(0)); }
      trail.setAttribute('d', parts.join(' '));
    }
    place(0);
    A.tween(300, 2600, function (p) { place(dStop * p); }, ease.out);
    A.at(2700, function () { bot.classList.add('is-warn'); evs[0].classList.add('is-on'); });
    A.at(4300, function () { bot.classList.remove('is-warn'); bot.classList.add('is-op'); evs[1].classList.add('is-on'); });
    A.tween(5400, 5600, function (p) { place(dStop + (P.total - dStop) * p); }, ease.inOut);
    A.at(8300, function () { bot.classList.remove('is-op'); evs[2].classList.add('is-on'); });

    // pedestrians on both pavements
    var peds = $('[data-peds]', el);
    peds.textContent = '';
    var list = [[520, 0.08, 100], [500, -0.06, 900], [536, 0.05, 1500], [780, -0.07, 300], [800, 0.06, 1200], [770, 0.09, 1700]].map(function (p) {
      var c = svgEl('circle', { r: 9, cy: p[0], cx: p[2] }, peds);
      return { c: c, v: p[1], x: p[2] };
    });
    A.tick(function (now) {
      list.forEach(function (p) {
        var x = ((p.x + now * p.v) % 2100 + 2100) % 2100 - 90;
        p.c.setAttribute('cx', x.toFixed(1));
      });
    });
  };

  // ---- 9 · Numbers ------------------------------------------------------
  var skylineBuilt = false, wins = [];
  SCENES.num = function (el, A) {
    var svg = $('[data-skyline]', el);
    if (!skylineBuilt) {
      skylineBuilt = true;
      var r = rng(7), blocks = $('[data-blocks]', svg), wg = $('[data-wins]', svg);
      for (var x = 0; x < 1920;) {
        var w = 70 + Math.floor(r() * 120), h = 120 + Math.floor(r() * 220);
        svgEl('rect', { x: x, y: 360 - h, width: w - 6, height: h }, blocks);
        for (var wy = 360 - h + 22; wy < 340; wy += 30) {
          for (var wx = x + 12; wx < x + w - 24; wx += 24) {
            if (r() > 0.25) wins.push(svgEl('rect', { 'class': 'wl', x: wx, y: wy, width: 10, height: 14, rx: 1.5 }, wg));
          }
        }
        x += w;
      }
      // shuffle once so windows light in a natural order
      for (var i = wins.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var tmp = wins[i]; wins[i] = wins[j]; wins[j] = tmp; }
    }
    wins.forEach(function (w) { w.classList.remove('is-on'); });
    var lit = 0;
    A.tween(1500, 6500, function (p) {
      var target = Math.floor(wins.length * 0.55 * p);
      while (lit < target) { wins[lit].classList.add('is-on'); lit++; }
    }, ease.lin);

    $$('[data-n]', el).forEach(function (s, i) {
      var to = +s.getAttribute('data-n'), from = +s.getAttribute('data-from'), pre = s.getAttribute('data-prefix') || '';
      s.classList.remove('is-done');
      s.textContent = pre + from;
      A.tween(900 + i * 220, 2000, function (p) { s.textContent = pre + Math.round(from + (to - from) * p); }, ease.outExpo);
      A.at(2950 + i * 220, function () { s.classList.add('is-done'); });
    });
  };

  // ---- 10 · Industries --------------------------------------------------
  SCENES.ind = function (el, A) {
    var cards = $$('.card', el);
    cards.forEach(function (c) { c.classList.remove('is-spot'); });
    for (var k = 0; k < 5; k++) {
      (function (k) {
        A.at(2800 + k * 1700, function () { cards.forEach(function (c, i) { c.classList.toggle('is-spot', k < 4 && i === k); }); });
      })(k);
    }
  };

  // ------------------------------------------------------------------------
  // Controls
  // ------------------------------------------------------------------------
  function next() { go(cur + 1); }
  function prev() { go(cur - 1); }
  function toggle() { setPlaying(!playing); }
  function restart() { go(0); setPlaying(true); }
  function fullscreen() {
    var d = document;
    if (d.fullscreenElement) { if (d.exitFullscreen) d.exitFullscreen(); }
    else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () { /* not allowed */ });
  }
  function openNotes() {
    window.open(location.pathname + '?notes', 'dng-notes', 'width=960,height=700');
  }
  var help = $('#help');
  (function fillHelp() {
    var dl = $('[data-help]');
    (S['ui.help_list'] || '').split('\n').forEach(function (line) {
      var p = line.split('|'); if (p.length < 2) return;
      var dt = document.createElement('dt'); dt.textContent = p[0];
      var dd = document.createElement('dd'); dd.textContent = p[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
  })();
  function toggleHelp(force) {
    var open = force != null ? force : !help.open;
    if (open && !help.open) { help.showModal(); } else if (!open && help.open) { help.close(); }
  }

  function start() {
    if (!body.classList.contains('is-cover')) return;
    body.classList.remove('is-cover');
    startedAt = performance.now();
    if (!params.has('nofs')) fullscreen();
    var s = clamp((+params.get('scene') || 1) - 1, 0, N - 1);
    go(s);
    setPlaying(true);
    poke();
  }

  var CMD = {
    start: start, next: next, prev: prev, toggle: toggle, restart: restart,
    loop: function () { setLoop(!loop); }, notes: openNotes, fullscreen: fullscreen,
    help: function () { toggleHelp(); }, 'help-close': function () { toggleHelp(false); }
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cmd]');
    if (b) { e.preventDefault(); CMD[b.getAttribute('data-cmd')](); return; }
    if (body.classList.contains('is-cover') || e.target.closest('a, button, input, label, dialog, .ctrl')) return;
    if (e.clientX < window.innerWidth / 3) prev(); else next();
  });
  var loopBox = $('[data-loop]');
  loopBox.addEventListener('change', function () { setLoop(loopBox.checked); });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (help.open && e.key !== 'Escape' && e.key !== '?') return;
    var k = e.key;
    if (body.classList.contains('is-cover')) {
      if (k === ' ' || k === 'Enter' || k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); start(); }
      else if (k === 'l' || k === 'L') setLoop(!loop);
      return;
    }
    poke();
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'p' || k === 'P' || k === 'k' || k === 'K' || k === 'MediaPlayPause') toggle();
    else if (k === 'Home' || k === 'r' || k === 'R') restart();
    else if (k === 'End') go(N - 1);
    else if (k === 'f' || k === 'F') fullscreen();
    else if (k === 'n' || k === 'N') openNotes();
    else if (k === 'l' || k === 'L') setLoop(!loop);
    else if (k === 'h' || k === 'H') body.classList.toggle('ctrl-off');
    else if (k === '?') toggleHelp();
    else if (/^[0-9]$/.test(k)) go(k === '0' ? 9 : +k - 1);
  });

  // auto-hide controls & cursor
  var idleTimer = 0;
  function poke() {
    body.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { if (!body.classList.contains('is-cover')) body.classList.add('is-idle'); }, 2600);
  }
  document.addEventListener('mousemove', poke);

  // speaker-notes window commands
  if (CH) {
    CH.onmessage = function (e) {
      var m = e.data || {};
      if (m.type === 'hello') broadcast(true);
      if (m.type === 'cmd' && CMD[m.cmd] && !body.classList.contains('is-cover')) CMD[m.cmd]();
      if (m.type === 'cmd' && m.cmd === 'next' && body.classList.contains('is-cover')) start();
    };
  }

  setLoop(loop);
  if (params.has('autostart')) {
    startedAt = performance.now();
    go(clamp((+params.get('scene') || 1) - 1, 0, N - 1));
    setPlaying(true);
    poke();
  } else {
    body.classList.add('is-cover');
    setPlaying(false);
    var sb = $('[data-cmd="start"]'); if (sb) sb.focus();
  }

  // ------------------------------------------------------------------------
  // Speaker notes window (?notes)
  // ------------------------------------------------------------------------
  function notesMode() {
    document.body.classList.add('is-notes');
    var box = document.getElementById('notes');
    box.hidden = false;
    var num = $('[data-n-num]'), ch = $('[data-n-ch]'), text = $('[data-n-text]'), barEl = $('[data-n-bar]');
    var time = $('[data-n-time]'), nextCh = $('[data-n-next-ch]'), nextText = $('[data-n-next]');
    var lastI = -2;
    document.title = (S['ui.notes'] || 'Notes') + ' — DeliveryNextGen';
    if (CH) {
      CH.onmessage = function (e) {
        var m = e.data || {};
        if (m.type !== 'state') return;
        if (m.i !== lastI) {
          lastI = m.i;
          if (m.i < 0) return;
          num.textContent = pad2(m.i + 1) + ' / ' + pad2(m.n);
          ch.textContent = chapters[m.i] || '';
          text.textContent = S['notes.' + (m.i + 1)] || '';
          var nx = m.i + 1 < m.n ? m.i + 1 : -1;
          nextCh.textContent = nx >= 0 ? (chapters[nx] || '') : (S['ui.notes_end'] || '');
          nextText.textContent = nx >= 0 ? (S['notes.' + (nx + 1)] || '') : '';
        }
        barEl.style.width = (m.dur ? Math.min(100, m.t / m.dur * 100) : 0) + '%';
        var sec = Math.floor((m.elapsed || 0) / 1000);
        time.textContent = Math.floor(sec / 60) + ':' + pad2(sec % 60);
      };
      CH.postMessage({ type: 'hello' });
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ncmd]');
      if (b) send({ type: 'cmd', cmd: b.getAttribute('data-ncmd') });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); send({ type: 'cmd', cmd: 'next' }); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); send({ type: 'cmd', cmd: 'prev' }); }
      if (e.key === 'p' || e.key === 'P') send({ type: 'cmd', cmd: 'toggle' });
    });
  }
})();
