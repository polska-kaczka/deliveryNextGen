/* ==========================================================================
   DeliveryNextGen — developer page (API preview)
   Playground and webhook simulator run entirely in the browser on simulated
   data: no network requests. Text is inserted with textContent only.
   Event names match the demo panel (/app/): delivery.created, .assigned,
   .en_route, .delivered, .cancelled.
   ========================================================================== */
(function () {
  'use strict';

  var LANG = (document.documentElement.lang || 'en').slice(0, 2) === 'pl' ? 'pl' : 'en';
  var T = {
    en: {
      ep: { create: 'Create delivery', get: 'Delivery status', cancel: 'Cancel', robots: 'Robots' },
      send: 'Send request', sending: 'Sending…', copy: 'Copy', copied: 'Copied',
      e400: 'Request body is not valid JSON.', e401: 'Missing or invalid API key. Use a key starting with dng_test_ or dng_live_.',
      e404: 'No delivery with this ID. Create one first.', e409: 'A delivered delivery cannot be cancelled.', e409c: 'This delivery is already cancelled.',
      e422: 'Some fields are missing or invalid.', req: 'is required', enumc: 'must be "standard" or "insulated"',
      run: 'Start a test delivery', running: 'Delivery in progress…', again: 'Run again'
    },
    pl: {
      ep: { create: 'Utwórz dostawę', get: 'Status dostawy', cancel: 'Anuluj', robots: 'Roboty' },
      send: 'Wyślij zapytanie', sending: 'Wysyłanie…', copy: 'Kopiuj', copied: 'Skopiowano',
      e400: 'Treść zapytania nie jest poprawnym JSON-em.', e401: 'Brak lub niepoprawny klucz API. Użyj klucza zaczynającego się od dng_test_ lub dng_live_.',
      e404: 'Nie ma dostawy o tym identyfikatorze. Najpierw ją utwórz.', e409: 'Doręczonej dostawy nie można anulować.', e409c: 'Ta dostawa jest już anulowana.',
      e422: 'Brakuje niektórych pól lub są niepoprawne.', req: 'jest wymagane', enumc: 'musi mieć wartość "standard" lub "insulated"',
      run: 'Uruchom testową dostawę', running: 'Dostawa w toku…', again: 'Uruchom ponownie'
    }
  }[LANG];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function iso(ms) { return new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z'); }

  // JSON with syntax colouring, built from text nodes (no innerHTML)
  function renderJSON(pre, obj) {
    pre.textContent = '';
    var src = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    var last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) pre.appendChild(document.createTextNode(src.slice(last, m.index)));
      var cls = m[1] ? (m[2] ? 'j-k' : 'j-s') : m[3] ? 'j-b' : 'j-n';
      pre.appendChild(el('span', cls, m[1] || m[0]));
      if (m[2]) pre.appendChild(document.createTextNode(m[2]));
      last = re.lastIndex;
    }
    if (last < src.length) pre.appendChild(document.createTextNode(src.slice(last)));
  }

  function copyText(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = T.copied; setTimeout(function () { btn.textContent = o; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  // ------------------------------------------------------------------------
  // Simulated backend shared by the playground and the webhook demo
  // ------------------------------------------------------------------------
  var store = {};
  var nextId = 4821;
  var ROBOTS = [
    { id: 'R-03', status: 'en_route', battery: 82, delivery_id: 'dlv_4817' },
    { id: 'R-07', status: 'idle', battery: 64, delivery_id: null },
    { id: 'R-11', status: 'charging', battery: 23, delivery_id: null },
    { id: 'R-14', status: 'assigned', battery: 91, delivery_id: 'dlv_4819' }
  ];
  function statusOf(d) {
    if (d.cancelled) return 'cancelled';
    var age = (Date.now() - d.created) / 1000;
    return age < 4 ? 'queued' : age < 10 ? 'assigned' : age < 25 ? 'en_route' : 'delivered';
  }
  function view(d) {
    var st = statusOf(d);
    return {
      id: d.id, status: st,
      pickup: d.pickup, dropoff: d.dropoff, window: d.window || null, compartment: d.compartment,
      robot_id: st === 'queued' ? null : 'R-07',
      eta_minutes: st === 'delivered' || st === 'cancelled' ? 0 : Math.max(1, 16 - Math.floor((Date.now() - d.created) / 2000)),
      tracking: { link_sent: true, pin_sent: st !== 'queued' },
      created_at: iso(d.created)
    };
  }
  function create(body) {
    var id = 'dlv_' + (nextId++);
    store[id] = { id: id, created: Date.now(), pickup: body.pickup, dropoff: body.dropoff, window: body.window, compartment: body.compartment || 'standard' };
    return store[id];
  }
  function err(code, message, fields) {
    var e = { error: { code: { 400: 'invalid_json', 401: 'unauthorized', 404: 'not_found', 409: 'conflict', 422: 'validation_failed' }[code], message: message } };
    if (fields) e.error.fields = fields;
    return { code: code, body: e };
  }

  var EP = {
    create: { m: 'POST', path: function () { return '/v1/deliveries'; }, body: true },
    get: { m: 'GET', path: function (id) { return '/v1/deliveries/' + id; }, id: true },
    cancel: { m: 'POST', path: function (id) { return '/v1/deliveries/' + id + '/cancel'; }, id: true },
    robots: { m: 'GET', path: function () { return '/v1/robots'; } }
  };
  var DEFAULT_BODY = JSON.stringify({ pickup: 'Trattoria Sole, Calle Mayor 12', dropoff: 'Plaza de la Villa 5, 3B', window: '21:50-22:10', compartment: 'insulated' }, null, 2);

  function handle(ep, key, id, raw) {
    if (!/^dng_(test|live)_[A-Za-z0-9]{6,}$/.test(key.trim())) return err(401, T.e401);
    if (ep === 'robots') return { code: 200, body: { data: ROBOTS, has_more: false } };
    if (ep === 'create') {
      var body;
      try { body = JSON.parse(raw); } catch (e) { return err(400, T.e400); }
      var f = {};
      if (!body || typeof body !== 'object' || Array.isArray(body)) return err(400, T.e400);
      ['pickup', 'dropoff'].forEach(function (k) { if (typeof body[k] !== 'string' || !body[k].trim()) f[k] = k + ' ' + T.req; });
      if (body.compartment != null && ['standard', 'insulated'].indexOf(body.compartment) === -1) f.compartment = 'compartment ' + T.enumc;
      if (Object.keys(f).length) return err(422, T.e422, f);
      return { code: 201, body: view(create(body)) };
    }
    var d = store[id.trim()];
    if (!d) return err(404, T.e404);
    if (ep === 'get') return { code: 200, body: view(d) };
    if (d.cancelled) return err(409, T.e409c);
    if (statusOf(d) === 'delivered') return err(409, T.e409);
    d.cancelled = true;
    return { code: 200, body: view(d) };
  }

  // ------------------------------------------------------------------------
  // Code samples
  // ------------------------------------------------------------------------
  function samples(ep, id, raw) {
    var e = EP[ep], path = e.path(id || '{id}'), m = e.m, body = null;
    if (e.body) { try { body = JSON.stringify(JSON.parse(raw), null, 2); } catch (x) { body = raw; } }
    var ind = function (s, n) { return s.split('\n').join('\n' + new Array(n + 1).join(' ')); };
    var curl = 'curl -X ' + m + ' "$DNG_API_URL' + path + '" \\\n  -H "Authorization: Bearer $DNG_API_KEY"' +
      (body ? ' \\\n  -H "Content-Type: application/json" \\\n  -d \'' + body.replace(/'/g, "'\\''") + '\'' : '');
    var js = 'const res = await fetch(`${process.env.DNG_API_URL}' + path + '`, {\n  method: "' + m + '",\n  headers: {\n    "Authorization": `Bearer ${process.env.DNG_API_KEY}`' +
      (body ? ',\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(' + ind(body, 2) + ')\n' : '\n  }\n') + '});\nconst data = await res.json();';
    var php = '$ch = curl_init(getenv("DNG_API_URL") . "' + path + '");\ncurl_setopt_array($ch, [\n  CURLOPT_CUSTOMREQUEST => "' + m + '",\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => [\n    "Authorization: Bearer " . getenv("DNG_API_KEY"),' +
      (body ? '\n    "Content-Type: application/json",\n  ],\n  CURLOPT_POSTFIELDS => json_encode(' + phpArr(body) + '),\n' : '\n  ],\n') + ']);\n$data = json_decode(curl_exec($ch), true);';
    var py = 'import os, requests\n\nres = requests.' + m.toLowerCase() + '(\n    os.environ["DNG_API_URL"] + "' + path + '",\n    headers={"Authorization": "Bearer " + os.environ["DNG_API_KEY"]},' +
      (body ? '\n    json=' + pyDict(body) + ',' : '') + '\n)\ndata = res.json()';
    return { curl: curl, js: js, php: php, py: py };
  }
  function phpArr(body) {
    try {
      var o = JSON.parse(body);
      return '[\n' + Object.keys(o).map(function (k) { return '    "' + k + '" => ' + JSON.stringify(o[k]); }).join(',\n') + ',\n  ]';
    } catch (e) { return '/* JSON */'; }
  }
  function pyDict(body) {
    try {
      var o = JSON.parse(body);
      return '{\n' + Object.keys(o).map(function (k) { return '        "' + k + '": ' + JSON.stringify(o[k]).replace(/^true$/, 'True').replace(/^false$/, 'False').replace(/^null$/, 'None'); }).join(',\n') + ',\n    }';
    } catch (e) { return '{}'; }
  }

  // ------------------------------------------------------------------------
  // Playground UI
  // ------------------------------------------------------------------------
  var pg = $('[data-playground]');
  if (pg) {
    var eps = $('[data-eps]', pg), keyIn = $('[data-key]', pg), idIn = $('[data-id]', pg), bodyIn = $('[data-body]', pg);
    var idWrap = $('[data-id-wrap]', pg), bodyWrap = $('[data-body-wrap]', pg);
    var sendBtn = $('[data-send]', pg), sendLbl = $('[data-send-label]', pg);
    var line = $('[data-line]', pg), statusEl = $('[data-status]', pg), msEl = $('[data-ms]', pg), resEl = $('[data-res]', pg);
    var codeEl = $('[data-code]', pg), tabs = $$('[data-tabs] [data-lang]', pg);
    var cur = 'create', lang = 'curl';
    bodyIn.value = DEFAULT_BODY;

    Object.keys(EP).forEach(function (k, i) {
      var b = el('button', 'dev-ep');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === 0));
      b.dataset.ep = k;
      b.appendChild(el('span', 'm m--' + EP[k].m.toLowerCase(), EP[k].m));
      b.appendChild(el('span', null, T.ep[k]));
      eps.appendChild(b);
    });

    function refresh() {
      var e = EP[cur];
      idWrap.hidden = !e.id;
      bodyWrap.hidden = !e.body;
      line.textContent = e.m + ' ' + e.path(e.id ? (idIn.value.trim() || '{id}') : '');
      $$('.dev-ep', eps).forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.ep === cur)); });
      codeEl.textContent = samples(cur, idIn.value.trim(), bodyIn.value)[lang];
    }

    eps.addEventListener('click', function (ev) {
      var b = ev.target.closest('.dev-ep'); if (!b) return;
      cur = b.dataset.ep; refresh();
    });
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        lang = t.dataset.lang;
        tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
        refresh();
      });
    });
    [idIn, bodyIn].forEach(function (i) { i.addEventListener('input', refresh); });

    sendBtn.addEventListener('click', function () {
      if (sendBtn.disabled) return;
      sendBtn.disabled = true; sendBtn.classList.add('is-busy'); sendLbl.textContent = T.sending;
      var ms = 140 + Math.floor(Math.random() * 260);
      setTimeout(function () {
        var r = handle(cur, keyIn.value, idIn.value, bodyIn.value);
        statusEl.hidden = false;
        statusEl.textContent = r.code + ' ' + ({ 200: 'OK', 201: 'Created', 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 409: 'Conflict', 422: 'Unprocessable Entity' }[r.code]);
        statusEl.className = 'dev-status ' + (r.code < 300 ? 'is-ok' : 'is-err');
        msEl.textContent = ms + ' ms';
        renderJSON(resEl, r.body);
        resEl.classList.remove('is-new'); void resEl.offsetWidth; resEl.classList.add('is-new');
        if (cur === 'create' && r.code === 201) idIn.value = r.body.id;
        sendBtn.disabled = false; sendBtn.classList.remove('is-busy'); sendLbl.textContent = T.send;
        refresh();
      }, ms);
    });

    $('[data-copy="code"]', pg).addEventListener('click', function (ev) { copyText(codeEl.textContent, ev.currentTarget); });
    refresh();
  }

  // ------------------------------------------------------------------------
  // Webhook simulator
  // ------------------------------------------------------------------------
  var wh = $('[data-webhooks]');
  if (wh) {
    var log = $('[data-wh-log]', wh), run = $('[data-wh-run]', wh), sig = $('[data-sig]', wh);
    sig.textContent = [
      'import crypto from "node:crypto";',
      '',
      '// header: DNG-Signature: t=1763400000,v1=5d2c…',
      'export function verify(rawBody, header, secret) {',
      '  const { t, v1 } = Object.fromEntries(',
      '    header.split(",").map((p) => p.split("="))',
      '  );',
      '  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;',
      '  const expected = crypto',
      '    .createHmac("sha256", secret)',
      '    .update(`${t}.${rawBody}`)',
      '    .digest("hex");',
      '  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));',
      '}'
    ].join('\n');
    $('[data-copy="sig"]', wh).addEventListener('click', function (ev) { copyText(sig.textContent, ev.currentTarget); });

    var STEPS = [['delivery.created', 'queued', 0], ['delivery.assigned', 'assigned', 1300], ['delivery.en_route', 'en_route', 2900], ['delivery.delivered', 'delivered', 6400]];
    var timers = [];
    function hex(n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }

    run.addEventListener('click', function () {
      timers.forEach(clearTimeout); timers = [];
      log.textContent = '';
      run.disabled = true; run.textContent = T.running;
      var d = create({ pickup: 'Trattoria Sole, Calle Mayor 12', dropoff: 'Plaza de la Villa 5, 3B', compartment: 'insulated' });
      STEPS.forEach(function (s, i) {
        timers.push(setTimeout(function () {
          var now = Date.now(), t = Math.floor(now / 1000);
          var payload = {
            id: 'evt_' + hex(12), type: s[0], created_at: iso(now),
            data: { delivery_id: d.id, status: s[1], robot_id: i ? 'R-07' : null, eta_minutes: [16, 15, 12, 0][i] }
          };
          var li = el('li', 'dev-wh-ev');
          var head = el('button', 'dev-wh-h');
          head.type = 'button';
          head.setAttribute('aria-expanded', 'false');
          head.appendChild(el('span', 'dev-wh-code', '200'));
          head.appendChild(el('span', 'dev-wh-type', s[0]));
          head.appendChild(el('span', 'dev-wh-t', new Date(now).toLocaleTimeString(LANG === 'pl' ? 'pl-PL' : 'en-GB')));
          var body = el('div', 'dev-wh-body');
          body.hidden = true;
          body.appendChild(el('p', 'dev-wh-sigline', 'DNG-Signature: t=' + t + ',v1=' + hex(64)));
          var pre = el('pre', 'dev-json dev-json--sm');
          renderJSON(pre, payload);
          body.appendChild(pre);
          head.addEventListener('click', function () {
            var open = head.getAttribute('aria-expanded') !== 'true';
            head.setAttribute('aria-expanded', String(open));
            body.hidden = !open;
          });
          li.appendChild(head); li.appendChild(body);
          log.appendChild(li);
          if (i === STEPS.length - 1) { run.disabled = false; run.textContent = T.again; head.click(); }
        }, s[2]));
      });
    });
  }
})();
