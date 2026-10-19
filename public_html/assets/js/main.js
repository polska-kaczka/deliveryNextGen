/* ==========================================================================
   DeliveryNextGen — interactions & motion (no dependencies, CSP-safe)
   ========================================================================== */
(function () {
  'use strict';

  window.__dngReady = true;

  var root = document.documentElement;
  var LANG = (root.lang || 'en').slice(0, 2) === 'pl' ? 'pl' : 'en';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  var T = {
    en: {
      required: 'This field is required.',
      email: 'Enter a valid business email address.',
      short: 'Please write at least 20 characters so we can prepare.',
      long: 'This text is too long.',
      consent: 'Please confirm you have read the privacy notice.',
      b2b: 'Our services are available to business customers only.',
      phone: 'Enter a valid phone number (digits, spaces, +, -).',
      sending: 'Sending…',
      network: 'We could not reach the server. Check your connection and try again, or email us directly.',
      generic: 'Something went wrong on our side. Please try again in a minute or email us directly.',
      fixErrors: 'Please correct the highlighted fields.',
      custom: 'Custom quote',
      enterprise: 'Enterprise',
      noResults: 'No questions match your search.',
      openMenu: 'Open menu',
      closeMenu: 'Close menu'
    },
    pl: {
      required: 'To pole jest wymagane.',
      email: 'Podaj poprawny służbowy adres e-mail.',
      short: 'Napisz co najmniej 20 znaków, abyśmy mogli się przygotować.',
      long: 'Tekst jest zbyt długi.',
      consent: 'Potwierdź, że zapoznałeś(-aś) się z informacją o przetwarzaniu danych.',
      b2b: 'Nasze usługi są dostępne wyłącznie dla przedsiębiorców.',
      phone: 'Podaj poprawny numer telefonu (cyfry, spacje, +, -).',
      sending: 'Wysyłanie…',
      network: 'Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie lub napisz do nas e-mail.',
      generic: 'Wystąpił błąd po naszej stronie. Spróbuj ponownie za chwilę lub napisz do nas e-mail.',
      fixErrors: 'Popraw zaznaczone pola.',
      custom: 'Wycena indywidualna',
      enterprise: 'Enterprise',
      noResults: 'Brak pytań pasujących do wyszukiwania.',
      openMenu: 'Otwórz menu',
      closeMenu: 'Zamknij menu'
    }
  }[LANG];

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };


  /* ------------------------------------------------------------- Split text */
  function splitWords(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            var wi = document.createElement('span');
            w.className = 'w';
            wi.className = 'wi';
            wi.textContent = part;
            wi.style.setProperty('--wi', i++);
            w.appendChild(wi);
            frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR' && n.tagName.toLowerCase() !== 'svg' && n.tagName !== 'SUP') {
          walk(n);
        }
      });
    })(el);
    el.classList.add('split');
  }
  $$('[data-split]').forEach(splitWords);

  // SMIL animations (robots moving on maps) also respect reduced motion
  if (reduceMotion) $$('svg').forEach(function (svg) { if (svg.pauseAnimations) svg.pauseAnimations(); });

  /* ----------------------------------------------------- Reveal on viewport */
  $$('[data-delay]').forEach(function (el) { el.style.setProperty('--d', el.dataset.delay); });
  $$('[data-stagger]').forEach(function (el) {
    Array.prototype.forEach.call(el.children, function (c, i) { c.style.setProperty('--si', i); });
  });
  $$('[data-draw]').forEach(function (svg) {
    $$('.draw', svg).forEach(function (p, i) {
      var len = 1000;
      try { if (p.getTotalLength) len = Math.ceil(p.getTotalLength()) + 2; } catch (err) { /* keep default */ }
      p.style.setProperty('--len', len);
      p.style.setProperty('--di', i);
    });
  });

  var revealEls = $$('[data-reveal], [data-stagger], [data-split], [data-draw], .timeline li');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* -------------------------------------------------------- Scrub highlight */
  var scrubs = $$('.scrub').map(function (el) {
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var s = document.createElement('span');
            s.className = 'sw';
            s.textContent = part;
            frag.appendChild(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    return { el: el, words: $$('.sw', el) };
  });

  /* ------------------------------------------------------------------ Story */
  var story = (function () {
    var wrap = $('[data-journey]');
    if (!wrap) return null;
    var mapBox = $('.phone-map', wrap);
    var path = $('.route', wrap);
    var marker = $('.robot-marker', wrap);
    var steps = $$('.story-steps li', wrap);
    var clocks = $$('[data-clock]', wrap);
    var etaEl = $('[data-eta]', wrap);
    var statusEl = $('[data-status]', wrap);
    var bar = $('.story-progress', wrap);
    var phone = $('.phone', wrap);
    var cam = $('.map-cam', wrap);
    var heading = $('.heading', wrap);
    var pinDigits = $$('.pin-digits i', wrap);
    var pin = (phone && phone.dataset.pin || '').split('');
    var statuses = (statusEl && statusEl.dataset.statuses || '').split('|');
    var len = path.getTotalLength();
    var stops = [0, 0.19, 0.56, 0.97]; // 21:47 · 21:50 · 21:56 · 22:03
    var start = 21 * 60 + 47, span = 16;
    var last = -1, typed = false, timers = [];
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;

    function typePin() {
      if (typed) return;
      typed = true;
      pinDigits.forEach(function (d, i) {
        timers.push(setTimeout(function () {
          d.textContent = pin[i] || '';
          d.classList.add('on');
          if (i === pinDigits.length - 1) timers.push(setTimeout(function () { phone.classList.add('unlocked'); }, 420));
        }, reduceMotion ? 0 : 350 + i * 300));
      });
    }
    function resetPin() {
      timers.forEach(clearTimeout);
      timers = [];
      typed = false;
      phone.classList.remove('unlocked');
      pinDigits.forEach(function (d) { d.textContent = ''; d.classList.remove('on'); });
    }

    function render(p) {
      p = clamp(p, 0, 1);
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      path.style.strokeDashoffset = len * (1 - p);
      var at = Math.max(0.001, len * p);
      var pt = path.getPointAtLength(at);
      marker.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
      // heading arrow follows the direction of travel
      var ahead = path.getPointAtLength(Math.min(len, at + 3));
      var behind = path.getPointAtLength(Math.max(0, at - 3));
      var ang = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 57.2958 + 90;
      if (heading) heading.setAttribute('transform', 'rotate(' + ang.toFixed(1) + ')');
      // the map camera follows the robot, like a navigation app
      if (cam) {
        var cx = clamp((150 - pt.x) * 0.5, -60, 60), cy = clamp((230 - pt.y) * 0.5, -70, 70);
        cam.setAttribute('transform', 'translate(' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')');
      }
      var idx = 0;
      stops.forEach(function (s, i) { if (p >= s) idx = i; });
      steps.forEach(function (li, i) {
        li.classList.toggle('is-active', i === idx);
        li.classList.toggle('is-done', i < idx);
      });
      var m = start + Math.round(p * span);
      var hhmm = String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      clocks.forEach(function (c) { c.textContent = hhmm; });
      if (etaEl) {
        var left = Math.max(0, span - Math.round(p * span));
        etaEl.textContent = left > 0 ? etaEl.dataset.template.replace('{m}', left) : etaEl.dataset.arrived;
      }
      if (statusEl && statuses[idx]) statusEl.textContent = statuses[idx];
      if (bar) bar.style.setProperty('--jp', p.toFixed(3));
      mapBox.classList.toggle('show-obstacle', p > 0.42 && p < 0.8);
      var arrived = p >= 0.97;
      phone.classList.toggle('show-pin', arrived);
      if (arrived) typePin(); else if (typed && p < 0.9) resetPin();
    }

    function update(vh) {
      if (reduceMotion) { render(1); return; }
      var pinEl = $('.story-pin', wrap);
      var sticky = getComputedStyle(pinEl).position === 'sticky';
      var p;
      if (sticky) {
        var r = wrap.getBoundingClientRect();
        p = -r.top / (r.height - vh);
      } else {
        var pr = phone.getBoundingClientRect();
        p = (vh * 0.9 - pr.top) / (pr.height + vh * 0.2);
      }
      render(p);
    }
    return { update: update };
  })();

  /* ------------------------------------------------------- Live fleet panel */
  $$('[data-live-dash]').forEach(function (dash) {
    var list = $('.ui-rows', dash);
    var kpi = $('.ui-kpi b', dash);
    if (!list || reduceMotion) return;
    var rows = $$('li', list);
    var addrs = rows.map(function (li) { return $('.addr', li).textContent; });
    var lbl = {
      go: ($('.badge--go', list) || {}).textContent || 'En route',
      ok: ($('.badge--ok', list) || {}).textContent || 'Delivered',
      wait: ($('.badge--wait', list) || {}).textContent || 'Assigned'
    };
    var nextId = 4822, count = parseInt(kpi.textContent, 10) || 248, n = 2;
    function setBadge(li, kind) {
      var b = $('.badge', li);
      b.className = 'badge badge--' + kind;
      b.textContent = lbl[kind];
    }
    setInterval(function () {
      if (!dash.classList.contains('anim-on') || document.hidden) return;
      // the row that was en route is delivered; the newest assigned one heads out
      $$('li', list).forEach(function (li) {
        var b = $('.badge', li);
        if (b.classList.contains('badge--go')) setBadge(li, 'ok');
      });
      var first = list.firstElementChild;
      if (first && $('.badge', first).classList.contains('badge--wait')) setBadge(first, 'go');
      var li = document.createElement('li');
      li.className = 'is-new';
      li.innerHTML = '<span class="id"></span><span class="addr"></span><span class="badge badge--wait"></span>';
      $('.id', li).textContent = '#' + (nextId++);
      $('.addr', li).textContent = addrs[(n++) % addrs.length];
      $('.badge', li).textContent = lbl.wait;
      list.insertBefore(li, list.firstChild);
      var all = $$('li', list);
      if (all.length > 5) {
        var last = all[all.length - 1];
        last.classList.add('is-out');
        setTimeout(function () { if (last.parentNode) last.parentNode.removeChild(last); }, 450);
      }
      count++;
      kpi.textContent = count;
      kpi.classList.remove('tick'); void kpi.offsetWidth; kpi.classList.add('tick');
    }, 3200);
  });

  /* --------------------------------------------------------------- Counters */
  function runCounter(el) {
    var target = parseFloat(el.dataset.count);
    var dec = parseInt(el.dataset.decimals || '0', 10);
    var pre = el.dataset.prefix || '';
    var suf = el.dataset.suffix || '';
    var fmt = function (v) { return pre + v.toFixed(dec).replace('.', LANG === 'pl' ? ',' : '.') + suf; };
    if (reduceMotion) { el.textContent = fmt(target); return; }
    var t0 = performance.now(), dur = 1500;
    (function step(now) {
      var k = clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(target * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { runCounter(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  /* --------------------------------------------------------------- Gallery */
  $$('[data-gallery]').forEach(function (g) {
    var id = g.id;
    var prev = $('[data-gallery-prev="' + id + '"]');
    var next = $('[data-gallery-next="' + id + '"]');
    var step = function () {
      var card = g.firstElementChild;
      return card ? card.getBoundingClientRect().width + 20 : g.clientWidth * 0.8;
    };
    var sync = function () {
      var max = g.scrollWidth - g.clientWidth - 2;
      if (prev) prev.disabled = g.scrollLeft <= 2;
      if (next) next.disabled = g.scrollLeft >= max;
    };
    if (prev) prev.addEventListener('click', function () { g.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { g.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    g.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  /* -------------------------------------------------- Segmented control/tabs */
  $$('[data-tabs]').forEach(function (box) {
    var tabs = $$('[role="tab"]', box);
    var thumb = $('.seg-thumb', box);
    var moveThumb = function (t) {
      if (!thumb || !t) return;
      thumb.style.width = t.offsetWidth + 'px';
      thumb.style.transform = 'translateX(' + t.offsetLeft + 'px)';
    };
    var select = function (t, focus, byUser) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(x.getAttribute('aria-controls'));
        if (!panel) return;
        if (on) {
          panel.hidden = false;
          panel.classList.remove('is-entering');
          void panel.offsetWidth;
          panel.classList.add('is-entering');
          $$('[data-reveal], [data-stagger], [data-draw]', panel).forEach(function (el) { el.classList.add('is-in'); });
        } else {
          panel.hidden = true;
        }
      });
      moveThumb(t);
      if (focus) t.focus();
      if (byUser && history.replaceState && t.dataset.hash) history.replaceState(null, '', '#' + t.dataset.hash);
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false, true); });
      t.addEventListener('keydown', function (e) {
        var k = e.key;
        if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'Home' && k !== 'End') return;
        e.preventDefault();
        var n = k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(tabs[n], true, true);
      });
    });
    var fromHash = tabs.filter(function (t) { return t.dataset.hash && ('#' + t.dataset.hash) === location.hash; })[0];
    select(fromHash || tabs[0]);
    if (fromHash) setTimeout(function () { box.scrollIntoView({ block: 'start', behavior: 'auto' }); }, 60);
    window.addEventListener('resize', function () { moveThumb(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0]); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveThumb(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0]); });
  });

  /* ==========================================================================
     Motion engine
     - [data-anim] blocks only animate while on screen (CSS + SMIL paused otherwise)
     - Robot rig: wheels, sprung body and shadow driven by simple physics
     - Hero scene: drive-in, braking, cruise and scroll-boosted parallax
     ========================================================================== */
  var scrollVel = 0;   // px/s, smoothed, updated by the scroll handler
  var lastScrollY = window.scrollY, lastScrollT = performance.now();

  function setSmil(rootEl, on) {
    $$('svg', rootEl).forEach(function (s) {
      if (s.ownerSVGElement) return; // only outermost <svg>
      if (on && !reduceMotion) { if (s.unpauseAnimations) s.unpauseAnimations(); }
      else if (s.pauseAnimations) s.pauseAnimations();
    });
  }
  var animBlocks = $$('[data-anim]');
  if ('IntersectionObserver' in window) {
    var aio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.classList.toggle('anim-on', en.isIntersecting);
        if (en.isIntersecting && !en.target.dataset.synced) {
          // first appearance: restart CSS and SMIL clocks together so both halves stay in sync
          en.target.dataset.synced = '1';
          $$('svg', en.target).forEach(function (s) { if (!s.ownerSVGElement && s.setCurrentTime) s.setCurrentTime(0); });
          if (en.target.getAnimations) en.target.getAnimations({ subtree: true }).forEach(function (a) {
            if (typeof CSSAnimation === 'undefined' || a instanceof CSSAnimation) a.currentTime = 0;
          });
        }
        setSmil(en.target, en.isIntersecting);
        if (en.isIntersecting) en.target.dispatchEvent(new CustomEvent('anim:in'));
      });
    }, { rootMargin: '80px 0px' });
    animBlocks.forEach(function (b) { setSmil(b, false); aio.observe(b); });
  } else {
    animBlocks.forEach(function (b) { b.classList.add('anim-on'); });
  }

  function Rig(svg) {
    this.wheels = $$('.wheel', svg);
    this.body = $('.rb-body', svg);
    this.drive = $('.robot-drive', svg);
    this.shadow = $('.rb-shadow', svg);
    this.tilt = 0; this.tiltV = 0; this.phase = 0;
  }
  // x: horizontal offset (SVG units), travel: distance (SVG units), speed: units/s
  Rig.prototype.update = function (dt, x, travel, speed, accel, t) {
    // pitch: damped spring towards a target given by acceleration (nose dips when braking)
    var target = clamp(-accel * 0.018, -2.4, 2.4);
    this.tiltV += ((target - this.tilt) * 140 - this.tiltV * 15) * dt;
    this.tilt += this.tiltV * dt;
    // road vibration grows with speed; slow breathing when parked
    this.phase += speed * dt * 0.09;
    var vib = Math.min(1, speed / 90);
    var bob = -Math.abs(Math.sin(this.phase)) * 1.4 * vib + Math.sin(t * 1.7) * 0.5 * (1 - vib);
    var angle = travel / 34 * 57.2958; // wheel radius 34 units
    this.wheels.forEach(function (w) { w.style.transform = 'rotate(' + angle.toFixed(2) + 'deg)'; });
    this.drive.setAttribute('transform', 'translate(' + x.toFixed(2) + ' 0)');
    this.body.setAttribute('transform', 'translate(0 ' + bob.toFixed(2) + ') rotate(' + this.tilt.toFixed(3) + ' 262 272)');
    var sx = 1 + bob * 0.006;
    this.shadow.setAttribute('transform', 'translate(' + x.toFixed(2) + ' 0) translate(262 308) scale(' + sx.toFixed(4) + ' 1) translate(-262 -308)');
  };

  function loopWhileVisible(el, step) {
    var visible = false, raf = 0, prev = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - prev) / 1000 || 0.016);
      prev = now;
      step(dt, now / 1000);
      raf = (visible && !document.hidden) ? requestAnimationFrame(frame) : 0;
    }
    function start() { if (!raf && visible && !document.hidden) { prev = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) start(); else stop();
    }, { rootMargin: '60px 0px' }).observe(el);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  }

  /* ---- Hero city scene ---- */
  $$('[data-scene]').forEach(function (scene) {
    var svg = $('.robot-svg', scene);
    if (!svg) return;
    var rig = new Rig(svg);
    var robotBox = $('.scene-robot', scene);
    var layers = $$('.scene-layer', scene).map(function (l) {
      return { el: l, speed: parseFloat(l.dataset.speed || '1'), tile: 0 };
    });
    var unit = 1, sceneW = 1;
    function measure() {
      sceneW = scene.clientWidth;
      unit = Math.max(0.1, robotBox.clientWidth / 520);
      layers.forEach(function (L) { L.tile = L.el.firstElementChild.getBoundingClientRect().width; });
    }
    measure();
    window.addEventListener('resize', measure);

    if (reduceMotion) { rig.update(0, 0, 0, 0, 0, 0); return; }

    var ENTER = 2.6, t = 0, world = 0, vWorld = 0, prevSpeed = 0, accelSm = 0, prevX = null;
    var easeOut = function (p) { return 1 - Math.pow(1 - p, 3.2); };
    loopWhileVisible(scene, function (dt, now) {
      t += dt;
      // 1) enter from the left, decelerating into place
      var startX = -(sceneW / 2 + robotBox.clientWidth * 0.6) / unit;
      var x = t < ENTER ? startX * (1 - easeOut(t / ENTER)) : 0;
      var vRobot = prevX === null ? 0 : (x - prevX) / dt;
      prevX = x;
      // 2) after a short stop, cruise; scrolling down speeds the city up
      var cruise = t > ENTER + 0.9 ? 0.05 * sceneW / unit : 0;
      var boost = Math.max(0, scrollVel) * 0.5 / unit;
      var target = Math.min(cruise + boost, 0.9 * sceneW / unit);
      vWorld += (target - vWorld) * Math.min(1, dt * (target > vWorld ? 1.6 : 2.4));
      world += vWorld * dt;
      layers.forEach(function (L) {
        if (!L.tile) return;
        var off = (world * unit * L.speed) % L.tile;
        L.el.style.transform = 'translateX(' + (-off).toFixed(2) + 'px)';
      });
      var speed = Math.abs(vRobot) + vWorld;
      var accel = (speed - prevSpeed) / dt;
      prevSpeed = speed;
      accelSm += (accel - accelSm) * Math.min(1, dt * 10);
      rig.update(dt, x, x + world, speed, accelSm, now);
    });
  });

  /* ---- Robot wandering (404) ---- */
  $$('[data-robot="wander"]').forEach(function (box) {
    var svg = $('.robot-svg', box);
    if (!svg) return;
    var rig = new Rig(svg);
    if (reduceMotion) { rig.update(0, 0, 0, 0, 0, 0); return; }
    var t = 0, prevX = -70, prevV = 0, accSm = 0;
    var ease = function (p) { return (1 - Math.cos(Math.PI * p)) / 2; };
    loopWhileVisible(box, function (dt, now) {
      t += dt;
      // drive right, pause, reverse, pause — a lost robot looking around
      var c = t % 9, x;
      if (c < 3) x = -70 + 140 * ease(c / 3);
      else if (c < 4.5) x = 70;
      else if (c < 7.5) x = 70 - 140 * ease((c - 4.5) / 3);
      else x = -70;
      var v = (x - prevX) / dt; prevX = x;
      accSm += (((v - prevV) / dt) - accSm) * Math.min(1, dt * 8); prevV = v;
      box.classList.toggle('is-paused', Math.abs(v) < 2);
      rig.update(dt, x, x, Math.abs(v), v >= 0 ? accSm : -accSm, now);
    });
  });

  /* -------------------------------------------- Navigation & scroll effects */
  var nav = $('#gnav');
  var toTop = $('.to-top');
  var timeline = $('.timeline');
  var menuOpen = false;
  var ticking = false;
  var darkBands = $$('.theme-dark, .story');

  function onScroll() {
    var y = window.scrollY;
    var vh = window.innerHeight;
    if (nav) {
      nav.classList.toggle('is-scrolled', y > 8);
      // Switch the bar to dark while it sits over a dark band (Apple-style)
      var navH = nav.offsetHeight;
      var overDark = !menuOpen && darkBands.some(function (b) {
        var r = b.getBoundingClientRect();
        return r.top <= navH / 2 && r.bottom > navH / 2;
      });
      nav.classList.toggle('is-dark', overDark);
    }
    if (toTop) toTop.classList.toggle('is-visible', y > vh * 1.5);
    var nowT = performance.now();
    var inst = (y - lastScrollY) / Math.max(0.016, (nowT - lastScrollT) / 1000);
    scrollVel += (inst - scrollVel) * 0.35;
    lastScrollY = y; lastScrollT = nowT;
    scrubs.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      var p = reduceMotion ? 1 : clamp((vh * 0.8 - r.top) / (r.height + vh * 0.3), 0, 1);
      var n = Math.round(p * s.words.length);
      s.words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
    });
    if (story) story.update(vh);
    if (timeline) {
      var tr = timeline.getBoundingClientRect();
      timeline.style.setProperty('--tp', reduceMotion ? 1 : clamp((vh * 0.7 - tr.top) / tr.height, 0, 1).toFixed(3));
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', function () { requestAnimationFrame(onScroll); });
  // let the scroll speed decay once the user stops scrolling
  setInterval(function () { if (performance.now() - lastScrollT > 120) scrollVel *= 0.6; }, 100);
  onScroll();

  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    var target = $('#main');
    if (target) target.focus({ preventScroll: true });
  });

  /* --------------------------------------------------- Language toggle */
  $$('.lang-toggle').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      a.classList.add('is-switching');
      setTimeout(function () { location.href = a.href; }, reduceMotion ? 0 : 340);
    });
  });
  window.addEventListener('pageshow', function () { $$('.lang-toggle.is-switching').forEach(function (a) { a.classList.remove('is-switching'); }); });

  /* ------------------------------------------------------------ Mobile menu */
  var toggle = $('.menu-toggle');
  var menu = $('#mobile-menu');
  if (toggle && menu) {
    $$('nav a', menu).forEach(function (a, i) { a.style.setProperty('--i', i); });
    var setMenu = function (open) {
      menuOpen = open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? T.closeMenu : T.openMenu);
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      if ('inert' in menu) menu.inert = !open;
      document.body.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
      onScroll();
      if (open) { var f = $('a', menu); if (f) setTimeout(function () { f.focus(); }, 150); }
    };
    if ('inert' in menu) menu.inert = true;
    toggle.addEventListener('click', function () { setMenu(!menuOpen); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1068 && menuOpen) setMenu(false); });
  }

  /* -------------------------------------------------------------------- FAQ */
  $$('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  var faqSearch = $('[data-faq-search]');
  var faqFilters = $$('[data-faq-filter]');
  var faqItems = $$('.faq-item[data-cat]');
  var faqEmpty = $('.faq-empty');
  var activeCat = 'all';
  function filterFaq() {
    var q = faqSearch ? faqSearch.value.trim().toLowerCase() : '';
    var shown = 0;
    faqItems.forEach(function (it) {
      var okCat = activeCat === 'all' || it.dataset.cat === activeCat;
      var okQ = !q || it.textContent.toLowerCase().indexOf(q) !== -1;
      it.hidden = !(okCat && okQ);
      if (!it.hidden) shown++;
    });
    if (faqEmpty) { faqEmpty.hidden = shown !== 0; faqEmpty.textContent = T.noResults; }
  }
  if (faqSearch) faqSearch.addEventListener('input', filterFaq);
  faqFilters.forEach(function (b) {
    b.addEventListener('click', function () {
      activeCat = b.dataset.faqFilter;
      faqFilters.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      filterFaq();
    });
  });

  /* ------------------------------------------------------------ Calculator */
  var calc = $('[data-calc]');
  if (calc) {
    var vol = $('#calc-volume', calc);
    var cost = $('#calc-cost', calc);
    var money = new Intl.NumberFormat(LANG === 'pl' ? 'pl-PL' : 'en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    var money2 = new Intl.NumberFormat(LANG === 'pl' ? 'pl-PL' : 'en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var plans = [{ name: 'Starter', price: 299, cap: 300 }, { name: 'Growth', price: 799, cap: 1000 }];
    var out = function (k) { return $('[data-out="' + k + '"]', calc); };
    var fill = function (input) {
      var pct = (input.value - input.min) / (input.max - input.min) * 100;
      input.style.setProperty('--fill', pct + '%');
    };
    var recalc = function () {
      var v = parseInt(vol.value, 10);
      var floor = Math.min(parseFloat(cost.max), Math.ceil(plans[0].price / v * 10) / 10);
      if (parseFloat(cost.value) < floor) cost.value = floor;
      var c = parseFloat(cost.value);
      fill(vol); fill(cost);
      $('[for="calc-volume"] output', calc).textContent = v.toLocaleString(LANG === 'pl' ? 'pl-PL' : 'en-IE');
      $('[for="calc-cost"] output', calc).textContent = money2.format(c);
      var current = v * c;
      out('current').textContent = money.format(current);
      var plan = plans.filter(function (p) { return v <= p.cap; })[0];
      if (plan) {
        out('plan').textContent = plan.name + ' · ' + money.format(plan.price);
        out('per').textContent = money2.format(plan.price / v);
        var diff = Math.max(0, current - plan.price);
        out('diff').textContent = (diff >= 0 ? '' : '−') + money.format(Math.abs(diff));
        out('diff').closest('.calc-big').dataset.sign = diff >= 0 ? 'pos' : 'neg';
      } else {
        out('plan').textContent = T.enterprise + ' · ' + T.custom;
        out('per').textContent = '—';
        out('diff').textContent = T.custom;
      }
    };
    vol.addEventListener('input', recalc);
    cost.addEventListener('input', recalc);
    recalc();
  }

  /* ------------------------------------------------------------ Legal TOC */
  var tocLinks = $$('.toc a[href^="#"]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var heads = tocLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id); });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    heads.forEach(function (h) { tio.observe(h); });
  }
  $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ==========================================================================
     Consent manager
     Only strictly necessary storage is used today, so the banner stays hidden
     until a non-essential category is switched to "in use" (data attribute
     on #cookie-dialog, generated from build.py). Scripts that need consent
     must be added as <script type="text/plain" data-consent="analytics" data-src="...">.
     ========================================================================== */
  var Consent = (function () {
    var KEY = 'dng-consent';
    var VERSION = 1;
    var MAX_AGE = 1000 * 60 * 60 * 24 * 365; // re-ask after 12 months
    var dialog = $('#cookie-dialog');
    var banner = $('#cookie-banner');
    if (!dialog) return null;
    var inUse = {};
    (dialog.dataset.inUse || '').split(',').forEach(function (c) { if (c) inUse[c.trim()] = true; });
    var cats = ['analytics', 'marketing'];

    function read() {
      try {
        var v = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!v || v.v !== VERSION || Date.now() - v.ts > MAX_AGE) return null;
        return v;
      } catch (e) { return null; }
    }
    function write(choice) {
      var prev = read();
      var data = { v: VERSION, ts: Date.now(), analytics: !!choice.analytics, marketing: !!choice.marketing };
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked: choice applies to this page view only */ }
      apply(data);
      // Withdrawn consent: reload so already-running scripts stop.
      if (prev && cats.some(function (c) { return prev[c] && !data[c]; })) location.reload();
      return data;
    }
    function apply(state) {
      $$('script[type="text/plain"][data-consent]').forEach(function (s) {
        if (!state || !state[s.dataset.consent] || s.dataset.loaded) return;
        var n = document.createElement('script');
        if (s.dataset.src) n.src = s.dataset.src;
        n.async = true;
        s.dataset.loaded = '1';
        document.head.appendChild(n);
      });
      document.dispatchEvent(new CustomEvent('dng:consent', { detail: state }));
    }
    function syncSwitches() {
      var st = read() || {};
      cats.forEach(function (c) {
        var sw = $('input[name="consent-' + c + '"]', dialog);
        if (!sw) return;
        sw.checked = !!st[c];
        sw.disabled = !inUse[c];
      });
    }
    function hideBanner() { if (banner) { banner.classList.remove('is-visible'); setTimeout(function () { banner.hidden = true; }, 600); } }
    function open() {
      syncSwitches();
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    }
    function close() { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); }

    $$('[data-cookie-settings]').forEach(function (b) { b.addEventListener('click', open); });
    $$('[data-consent-accept]').forEach(function (b) { b.addEventListener('click', function () { write({ analytics: inUse.analytics, marketing: inUse.marketing }); hideBanner(); close(); }); });
    $$('[data-consent-reject]').forEach(function (b) { b.addEventListener('click', function () { write({}); hideBanner(); close(); }); });
    $$('[data-consent-save]').forEach(function (b) {
      b.addEventListener('click', function () {
        var choice = {};
        cats.forEach(function (c) { var sw = $('input[name="consent-' + c + '"]', dialog); choice[c] = !!(sw && sw.checked && inUse[c]); });
        write(choice); hideBanner(); close();
      });
    });
    $$('[data-consent-close]').forEach(function (b) { b.addEventListener('click', close); });

    var state = read();
    var needed = cats.some(function (c) { return inUse[c]; });
    if (state) apply(state);
    else if (needed && banner) { banner.hidden = false; setTimeout(function () { banner.classList.add('is-visible'); }, 900); }
    return { open: open, read: read };
  })();

  /* ==========================================================================
     Lead form
     ========================================================================== */
  var card = $('[data-lead]');
  if (card) {
    var form = $('form', card);
    var statusEl = $('.form-status', card);
    var btn = $('button[type="submit"]', form);
    var btnLabel = $('.label', btn);
    var btnText = btnLabel.textContent;
    var tokenInput = form.elements.csrf;
    var tokenPromise = null;

    // Prefill plan / client type from the URL (?plan=growth&type=restaurant)
    var params = new URLSearchParams(location.search);
    ['plan', 'user_type'].forEach(function (name) {
      var v = params.get(name === 'user_type' ? 'type' : name);
      var el = form.elements[name];
      if (v && el && $$('option', el).some(function (o) { return o.value === v; })) el.value = v;
    });

    // The token request starts the PHP session (cookie) only once the visitor
    // starts using the form, never on page load.
    function getToken() {
      if (tokenPromise) return tokenPromise;
      tokenPromise = fetch(form.dataset.token, { credentials: 'same-origin', headers: { 'Accept': 'application/json' }, cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('token'); return r.json(); })
        .then(function (d) { tokenInput.value = d.token || ''; return tokenInput.value; })
        .catch(function (e) { tokenPromise = null; throw e; });
      return tokenPromise;
    }
    form.addEventListener('focusin', function () { getToken().catch(function () { /* retried on submit */ }); }, { once: true });

    // Character counter
    var msg = form.elements.message;
    var counter = $('[data-counter]', form);
    if (msg && counter) {
      var upd = function () { counter.textContent = msg.value.length + ' / ' + msg.maxLength; };
      msg.addEventListener('input', upd); upd();
    }

    function setError(name, text) {
      var el = form.elements[name];
      if (!el) return;
      var field = el.closest('.field, .check');
      var err = $('#err-' + name, form);
      if (field) field.classList.toggle('has-error', !!text);
      el.setAttribute('aria-invalid', text ? 'true' : 'false');
      if (err) err.textContent = text || '';
    }

    function validate() {
      var errs = {};
      var f = form.elements;
      ['firstname', 'lastname', 'company', 'user_type', 'message'].forEach(function (n) {
        if (f[n] && f[n].required && !f[n].value.trim()) errs[n] = T.required;
      });
      if (!f.email.value.trim()) errs.email = T.required;
      else if (!/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i.test(f.email.value.trim())) errs.email = T.email;
      if (f.phone && f.phone.value.trim() && !/^[+\d][\d\s()\-]{5,24}$/.test(f.phone.value.trim())) errs.phone = T.phone;
      if (!errs.message && f.message.value.trim().length < 20) errs.message = T.short;
      if (!f.b2b.checked) errs.b2b = T.b2b;
      if (!f.privacy.checked) errs.privacy = T.consent;
      ['firstname', 'lastname', 'email', 'company', 'phone', 'user_type', 'plan', 'message', 'b2b', 'privacy'].forEach(function (n) { setError(n, errs[n]); });
      return errs;
    }

    $$('input, select, textarea', form).forEach(function (el) {
      el.addEventListener('blur', function () {
        if (el.getAttribute('aria-invalid') === 'true') validate();
      });
    });

    function showStatus(text) {
      statusEl.textContent = text;
      statusEl.className = 'form-status is-error';
      statusEl.setAttribute('role', 'alert');
    }
    function clearStatus() { statusEl.textContent = ''; statusEl.className = 'form-status'; }
    function busy(on) {
      btn.disabled = on;
      btn.classList.toggle('is-sending', on);
      btnLabel.textContent = on ? T.sending : btnText;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearStatus();
      var errs = validate();
      var keys = Object.keys(errs);
      if (keys.length) {
        showStatus(T.fixErrors);
        var first = form.elements[keys[0]];
        if (first && first.focus) first.focus();
        return;
      }
      busy(true);
      getToken()
        .then(function () {
          var fd = new FormData(form);
          fd.append('lang', LANG);
          return fetch(form.action, { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'Accept': 'application/json' } });
        })
        .then(function (r) {
          return r.json().catch(function () { return { status: 'error', message: T.generic }; });
        })
        .then(function (data) {
          if (data && data.status === 'success') {
            card.classList.add('is-sent');
            form.reset();
            var h = $('.form-success h3', card);
            if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
            return;
          }
          if (data && data.errors) Object.keys(data.errors).forEach(function (k) { setError(k, data.errors[k]); });
          if (data && data.code === 'csrf') { tokenPromise = null; tokenInput.value = ''; }
          showStatus((data && data.message) || T.generic);
          busy(false);
        })
        .catch(function () {
          tokenPromise = null;
          showStatus(T.network);
          busy(false);
        });
    });
  }
})();
