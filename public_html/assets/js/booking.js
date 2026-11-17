/* ==========================================================================
   DeliveryNextGen — demo slot picker for the contact form (no dependencies)
   Offers the next 10 weekdays, 09:00–12:30 and 14:00–17:30 Spanish time
   (Europe/Madrid), 30-minute steps. The choice goes to the hidden "slot"
   field (YYYY-MM-DDTHH:MM, Madrid time); send_lead.php validates the same
   rules. Also pre-fills the message from ?city=…&topic=demo|waitlist.
   ========================================================================== */
(function () {
  'use strict';

  var LANG = (document.documentElement.lang || 'en').slice(0, 2) === 'pl' ? 'pl' : 'en';
  var LOCALE = LANG === 'pl' ? 'pl-PL' : 'en-GB';
  var TZ = 'Europe/Madrid';
  var T = {
    en: {
      chosen: 'Selected: ', spain: ' Spanish time', yours: ' · your time ',
      waitlist: 'Please let us know when DeliveryNextGen is available in: {city}.',
      demo: 'We would like a demo for our business in {city}. '
    },
    pl: {
      chosen: 'Wybrano: ', spain: ' czasu hiszpańskiego', yours: ' · u Ciebie ',
      waitlist: 'Prosimy o informację, gdy DeliveryNextGen będzie dostępny w mieście: {city}.',
      demo: 'Chcielibyśmy umówić demo dla naszej firmy w mieście: {city}. '
    }
  }[LANG];

  // ---- message pre-fill from the coverage page ---------------------------
  var params = new URLSearchParams(location.search);
  var city = (params.get('city') || '').replace(/[^\p{L}\p{M} .'\-]/gu, '').trim().slice(0, 60);
  var topic = params.get('topic');
  var msg = document.getElementById('f-message');
  if (city && msg && !msg.value.trim() && (topic === 'waitlist' || topic === 'demo')) {
    msg.value = T[topic].replace('{city}', city);
    msg.dispatchEvent(new Event('input'));
  }

  var box = document.querySelector('[data-slots]');
  if (!box || !window.Intl) return;

  var daysEl = box.querySelector('[data-days]');
  var timesEl = box.querySelector('[data-times]');
  var pick = box.querySelector('[data-pick]');
  var pickText = box.querySelector('[data-pick-text]');
  var input = box.querySelector('[data-slot]');
  var clearBtn = box.querySelector('[data-clear]');
  var TIMES = [];
  [9, 10, 11, 12, 14, 15, 16, 17].forEach(function (h) { TIMES.push([h, 0], [h, 30]); });

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Date parts of an instant in a given time zone
  function partsIn(ts, tz) {
    var o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(ts)).forEach(function (p) { o[p.type] = +p.value; });
    return o;
  }
  // Madrid wall-clock time -> UTC timestamp
  function madridToUtc(y, m, d, h, mi) {
    var guess = Date.UTC(y, m - 1, d, h, mi);
    for (var i = 0; i < 2; i++) {
      var p = partsIn(guess, TZ);
      var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
      guess -= asUtc - Date.UTC(y, m - 1, d, h, mi);
    }
    return guess;
  }

  // next 10 weekdays from tomorrow (Madrid calendar)
  var now = partsIn(Date.now(), TZ);
  var days = [];
  var cursor = Date.UTC(now.year, now.month - 1, now.day, 12);
  while (days.length < 10) {
    cursor += 86400000;
    var dt = new Date(cursor);
    var wd = dt.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    days.push({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), date: dt });
  }

  var fmtWd = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' });
  var fmtMon = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });
  var fmtLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  var fmtLocal = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
  var userTz = '';
  try { userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { userTz = ''; }

  var selDay = -1, selTime = -1;

  function radio(label, cls, idx, group) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.tabIndex = -1;
    b.dataset.i = String(idx);
    b.dataset.g = group;
    if (typeof label === 'string') b.textContent = label; else b.appendChild(label);
    return b;
  }

  function renderDays() {
    daysEl.textContent = '';
    days.forEach(function (d, i) {
      var f = document.createDocumentFragment();
      var w = document.createElement('span'); w.className = 'sd-wd'; w.textContent = fmtWd.format(d.date).replace('.', '');
      var n = document.createElement('span'); n.className = 'sd-n'; n.textContent = d.d;
      var m = document.createElement('span'); m.className = 'sd-m'; m.textContent = fmtMon.format(d.date).replace('.', '');
      f.appendChild(w); f.appendChild(n); f.appendChild(m);
      var b = radio(f, 'slot-day', i, 'd');
      b.setAttribute('aria-label', fmtLong.format(d.date));
      daysEl.appendChild(b);
    });
    syncTabStops(daysEl, selDay);
  }

  function renderTimes() {
    timesEl.textContent = '';
    if (selDay < 0) { timesEl.hidden = true; return; }
    timesEl.hidden = false;
    TIMES.forEach(function (t, i) {
      timesEl.appendChild(radio(t[0] + ':' + pad(t[1]), 'slot-time', i, 't'));
    });
    syncTabStops(timesEl, selTime);
  }

  function syncTabStops(group, sel) {
    var items = group.children;
    for (var i = 0; i < items.length; i++) {
      var on = i === sel;
      items[i].setAttribute('aria-checked', String(on));
      items[i].classList.toggle('is-on', on);
      items[i].tabIndex = (sel < 0 ? i === 0 : on) ? 0 : -1;
    }
  }

  function update() {
    syncTabStops(daysEl, selDay);
    syncTabStops(timesEl, selTime);
    if (selDay < 0 || selTime < 0) {
      input.value = '';
      pick.hidden = true;
      return;
    }
    var d = days[selDay], t = TIMES[selTime];
    input.value = d.y + '-' + pad(d.m) + '-' + pad(d.d) + 'T' + pad(t[0]) + ':' + pad(t[1]);
    var text = T.chosen + fmtLong.format(d.date) + ', ' + t[0] + ':' + pad(t[1]) + T.spain;
    if (userTz && userTz !== TZ) {
      var ts = madridToUtc(d.y, d.m, d.d, t[0], t[1]);
      var local = fmtLocal.format(new Date(ts));
      if (local !== pad(t[0]) + ':' + pad(t[1]) && local !== t[0] + ':' + pad(t[1])) text += T.yours + local;
    }
    pickText.textContent = text;
    pick.hidden = false;
    var field = box.closest('.field');
    if (field) field.classList.remove('has-error');
    var err = document.getElementById('err-slot');
    if (err) err.textContent = '';
  }

  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]');
    if (!b) return;
    var i = +b.dataset.i;
    if (b.dataset.g === 'd') {
      if (selDay !== i) { selDay = i; selTime = -1; renderTimes(); }
    } else {
      selTime = i;
    }
    update();
  });

  // arrow keys inside each radio group
  box.addEventListener('keydown', function (e) {
    var b = e.target.closest('[data-g]');
    if (!b) return;
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    var group = b.parentNode, n = group.children.length, i = +b.dataset.i;
    var j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + keys[e.key] + n) % n;
    var target = group.children[j];
    target.click();
    target.focus();
  });

  clearBtn.addEventListener('click', function () {
    selDay = -1; selTime = -1;
    renderTimes(); update();
    var first = daysEl.firstElementChild; if (first) first.focus();
  });

  var form = box.closest('form');
  if (form) form.addEventListener('reset', function () { selDay = -1; selTime = -1; setTimeout(function () { renderTimes(); update(); }, 0); });

  renderDays();
  renderTimes();
  update();
})();
