/* ==========================================================================
   DeliveryNextGen — coverage checker (runs only in the browser)
   City list comes from COVERAGE in build.py via data-cities.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-coverage]');
  if (!root) return;
  var LANG = (document.documentElement.lang || 'en').slice(0, 2) === 'pl' ? 'pl' : 'en';
  var T = {
    en: {
      yesK: 'In coverage', yesT: 'Yes — we operate in {city}.', yesP: 'We’ll confirm the exact area (districts, pedestrian zones, estates) during the demo.', yesCta: 'Book a demo in {city}',
      noK: 'Not yet', noT: 'We’re not in {city} yet.', noP: 'Join the waiting list — we’ll let you know as soon as we launch there.', noCta: 'Join the waiting list',
      empty: 'Type the name of a city.'
    },
    pl: {
      yesK: 'W zasięgu', yesT: 'Tak — działamy w mieście {city}.', yesP: 'Dokładny obszar (dzielnice, strefy piesze, osiedla) potwierdzimy podczas demo.', yesCta: 'Umów demo: {city}',
      noK: 'Jeszcze nie', noT: 'Nie ma nas jeszcze w mieście {city}.', noP: 'Zapisz się na listę oczekujących — damy znać, gdy tylko tam wystartujemy.', noCta: 'Zapisz się na listę',
      empty: 'Wpisz nazwę miasta.'
    }
  }[LANG];

  var cities = [];
  try { cities = JSON.parse(root.getAttribute('data-cities') || '[]'); } catch (e) { cities = []; }

  function norm(s) {
    return String(s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  cities.forEach(function (c) { c.na = c.a.map(norm); });

  var form = root.querySelector('[data-cv-form]');
  var input = root.querySelector('[data-cv-input]');
  var list = root.querySelector('[data-cv-list]');
  var res = root.querySelector('[data-cv-result]');
  var k = root.querySelector('[data-cv-k]');
  var t = root.querySelector('[data-cv-t]');
  var p = root.querySelector('[data-cv-p]');
  var cta = root.querySelector('[data-cv-cta]');
  var contact = cta.getAttribute('href').split('?')[0].split('#')[0];
  var dots = Array.prototype.slice.call(root.querySelectorAll('[data-city]'));

  cities.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.n;
    list.appendChild(o);
  });

  function find(q) {
    var n = norm(q);
    if (!n) return null;
    var hit = cities.filter(function (c) { return c.na.indexOf(n) !== -1; })[0];
    if (hit) return hit;
    if (n.length >= 3) hit = cities.filter(function (c) { return c.na.some(function (a) { return a.indexOf(n) === 0; }); })[0];
    return hit || null;
  }

  function highlight(key) {
    dots.forEach(function (d) {
      var on = d.getAttribute('data-city') === key;
      d.classList.toggle('is-active', on);
      if (on) d.parentNode.appendChild(d); // draw on top
    });
    root.classList.toggle('has-active', !!key);
  }

  function show(q) {
    var raw = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    res.hidden = false;
    res.classList.remove('is-yes', 'is-no', 'is-empty', 'is-new');
    void res.offsetWidth;
    res.classList.add('is-new');
    if (!raw) {
      res.classList.add('is-empty');
      k.textContent = ''; t.textContent = T.empty; p.textContent = ''; cta.hidden = true;
      highlight(null);
      input.focus();
      return;
    }
    var c = find(raw);
    cta.hidden = false;
    if (c) {
      res.classList.add('is-yes');
      k.textContent = T.yesK;
      t.textContent = T.yesT.replace('{city}', c.n);
      p.textContent = T.yesP;
      cta.textContent = T.yesCta.replace('{city}', c.n);
      cta.href = contact + '?city=' + encodeURIComponent(c.n) + '&topic=demo#demo-form';
      highlight(c.k);
    } else {
      res.classList.add('is-no');
      k.textContent = T.noK;
      t.textContent = T.noT.replace('{city}', raw);
      p.textContent = T.noP;
      cta.textContent = T.noCta;
      cta.href = contact + '?city=' + encodeURIComponent(raw) + '&topic=waitlist#demo-form';
      highlight(null);
    }
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); show(input.value); });

  function pickKey(key) {
    var c = cities.filter(function (x) { return x.k === key; })[0];
    if (!c) return;
    input.value = c.n;
    show(c.n);
  }
  root.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-pick]');
    if (chip) { pickKey(chip.getAttribute('data-pick')); return; }
    var dot = e.target.closest('[data-city]');
    if (dot) pickKey(dot.getAttribute('data-city'));
  });
})();
