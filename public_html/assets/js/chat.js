/* ==========================================================================
   DeliveryNextGen — support chat demo (no API, no network, CSP-safe)
   Pre-written answers matched by keywords. Nothing leaves the browser:
   the conversation lives only in sessionStorage ("dng-chat") for this tab.
   All text is inserted with textContent — no innerHTML for messages.
   ========================================================================== */
(function () {
  'use strict';

  var mount = document.getElementById('dng-chat');
  if (!mount) return;

  var LANG = (document.documentElement.lang || 'en').slice(0, 2) === 'pl' ? 'pl' : 'en';
  var LINKS = {};
  try { LINKS = JSON.parse(mount.getAttribute('data-links') || '{}'); } catch (e) { LINKS = {}; }
  var EMAIL = mount.getAttribute('data-email') || '';
  var PHONE = mount.getAttribute('data-phone') || '';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STORE = 'dng-chat';

  // ------------------------------------------------------------------------
  // UI strings
  // ------------------------------------------------------------------------
  var UI = {
    en: {
      open: 'Open support chat', close: 'Close chat', reset: 'Start over',
      name: 'Nova', role: 'DeliveryNextGen assistant',
      status: 'Virtual assistant · demo',
      placeholder: 'Ask a question…', send: 'Send', label: 'Your message',
      note: 'Demo with pre-written answers. Please don’t share personal data.',
      teaser: 'Questions about delivery robots? Ask me.',
      typing: 'Nova is typing', you: 'You', bot: 'Nova',
      dismiss: 'Dismiss'
    },
    pl: {
      open: 'Otwórz czat pomocy', close: 'Zamknij czat', reset: 'Zacznij od nowa',
      name: 'Nova', role: 'asystentka DeliveryNextGen',
      status: 'Wirtualna asystentka · demo',
      placeholder: 'Zadaj pytanie…', send: 'Wyślij', label: 'Twoja wiadomość',
      note: 'Demo z gotowymi odpowiedziami. Nie podawaj danych osobowych.',
      teaser: 'Pytania o roboty dostawcze? Napisz do mnie.',
      typing: 'Nova pisze', you: 'Ty', bot: 'Nova',
      dismiss: 'Zamknij'
    }
  }[LANG];

  // ------------------------------------------------------------------------
  // Knowledge base. Each intent: keyword stems (matched against the start of
  // normalised words, diacritics removed), answer paragraphs, link buttons
  // (page keys resolved via data-links) and follow-up chips (intent ids).
  // Facts mirror the site content (pricing, FAQ, contact).
  // ------------------------------------------------------------------------
  var KB = {
    en: {
      chips: {
        pricing: 'Pricing', how: 'How it works', coverage: 'Where do you operate?',
        integration: 'Integration & API', track: 'Track a delivery', food: 'Hot food?',
        safety: 'Safety', demo: 'Book a demo', human: 'Talk to a person', live: 'Try the live panel',
        b2b: 'Who can order?', privacy: 'Your data', hours: 'Operating hours', permits: 'Permits'
      },
      greeting: ['Hi, I’m Nova 👋', 'I can answer common questions about DeliveryNextGen robots, plans and integration. What would you like to know?'],
      start: ['pricing', 'how', 'track', 'integration', 'human'],
      fallback: [
        ['I’m not sure I understood that. I’m a demo assistant with a limited set of answers.', 'Try one of these topics, or ask our team directly:'],
        ['Sorry, that’s outside what I can answer in this demo.', 'A person from our team will help you — we reply within one business day.']
      ],
      track: {
        ask: ['Sure. Enter a delivery number — in this demo any number works, e.g. 4821.'],
        bad: ['That doesn’t look like a delivery number. Use digits only, e.g. 4821 — or type “cancel”.'],
        cancel: ['No problem. Anything else?'],
        states: [
          ['Delivery #{id} is on its way. 🤖', 'The robot is {d} blocks away, arriving in about {m} min. Your customer gets a one-time PIN to open the compartment.'],
          ['Delivery #{id} has been delivered. ✅', 'The compartment was opened with the PIN {m} min ago. The robot is returning to the hub.'],
          ['Delivery #{id} is being prepared.', 'A robot has been assigned and will leave the hub in about {m} min.']
        ],
        note: 'Simulated status — this demo is not connected to real deliveries.'
      },
      intents: {
        greet: { k: ['hi', 'hello', 'hey', 'morning', 'evening', 'hiya'], a: ['Hello! How can I help you today?'], c: ['pricing', 'how', 'demo'] },
        thanks: { k: ['thank', 'thx', 'cheers', 'great', 'perfect', 'awesome'], a: ['You’re welcome! Anything else I can help with?'], c: ['demo', 'human'] },
        bye: { k: ['bye', 'goodbye', 'later'], a: ['Thanks for stopping by. Have a good day!'], c: [] },
        pricing: {
          k: ['price', 'pricing', 'cost', 'plan', 'much', 'eur', 'euro', 'starter', 'growth', 'enterprise', 'many', 'subscription', 'fee', 'cheap', 'expensive', 'budget', 'pay'],
          a: ['We have three plans (net prices, excl. VAT):', '• Starter — €299/month, up to 300 deliveries, 1 robot\n• Growth — €799/month, up to 1,000 deliveries, 3 robots, restaurant mode\n• Enterprise — custom quote, unlimited deliveries, full fleet, SLA', 'The pricing page has a calculator that shows the cost per delivery for your volume.'],
          l: [['pricing', 'See pricing & calculator']], c: ['demo', 'b2b']
        },
        how: {
          k: ['how', 'robot', 'works', 'autonom', 'technolog', 'sensor', 'drive', 'navigat'],
          a: ['You create an order (API, plugin or dashboard), our dispatcher assigns the nearest robot, and it drives to the address on its own. Your customer follows it live and opens the compartment with a one-time PIN.', 'If a robot can’t solve a situation itself, an operator in our operations centre takes over remotely within seconds.'],
          l: [['how', 'How it works']], c: ['safety', 'track', 'live']
        },
        coverage: {
          k: ['city', 'cities', 'area', 'where', 'available', 'spain', 'country', 'location', 'region', 'madrid', 'barcelona', 'valencia', 'seville', 'operate', 'coverage'],
          a: ['We’re based in Spain and serve all major cities there. Robots are built for narrow streets, pedestrian zones, gated estates and hilly terrain.', 'Coverage depends on local rules, so we confirm your exact area during the demo — before you sign anything.'],
          l: [['contact', 'Check my area']], c: ['permits', 'demo']
        },
        integration: {
          k: ['api', 'integrat', 'webhook', 'plugin', 'shopify', 'woocommerce', 'magento', 'csv', 'connect', 'setup', 'install', 'developer', 'docs', 'sdk', 'rest'],
          a: ['Most integrations are live in about 48 hours. You can use our REST API with webhooks, plugins for popular e-commerce platforms, CSV import, or a no-code dashboard for manual dispatch.', 'Our team guides you through the setup. You can explore the integrations view in the live demo panel.'],
          l: [['app_integrations', 'Open integrations demo']], c: ['live', 'demo']
        },
        trackinfo: {
          k: ['tracking', 'follow', 'eta', 'pin', 'notification', 'sms'],
          a: ['Your customers get a tracking link with the robot’s live position and estimated arrival, plus a one-time PIN to open the compartment.'],
          c: ['track', 'live']
        },
        food: {
          k: ['hot', 'food', 'restaurant', 'temperat', 'pizza', 'meal', 'cold', 'warm', 'grocer', 'insulat'],
          a: ['Yes. The Growth and Enterprise plans include restaurant mode: an insulated compartment that keeps the temperature, and a priority dispatch queue for short delivery windows.'],
          l: [['solutions', 'Solutions by industry']], c: ['pricing', 'demo']
        },
        hours: {
          k: ['hour', '24', 'night', 'weekend', 'sunday', 'shift', 'charg', 'battery'],
          a: ['All plans include 24/7 autonomous operation. Robots drive themselves to charging stations between jobs, so the fleet is ready whenever orders come in.'],
          c: ['pricing', 'how']
        },
        safety: {
          k: ['safe', 'obstacle', 'accident', 'theft', 'steal', 'stolen', 'vandal', 'crash', 'pedestrian', 'secure', 'lock'],
          a: ['Robots detect obstacles in real time and re-route automatically. If they can’t resolve a situation, an operator takes remote control within seconds.', 'Cargo is locked and opens only with the customer’s one-time PIN.'],
          l: [['how', 'Inside the robot']], c: ['permits', 'demo']
        },
        permits: {
          k: ['permit', 'law', 'legal', 'regulat', 'licen', 'complian', 'allowed', 'insurance'],
          a: ['Rules differ by city and country. We handle permits and compliance in the markets where we operate and confirm coverage for your area during the demo.'],
          l: [['legal', 'Legal notice']], c: ['coverage', 'demo']
        },
        b2b: {
          k: ['consumer', 'private', 'individual', 'personal', 'b2b', 'business', 'company', 'freelanc', 'sole', 'who'],
          a: ['We work with businesses only (B2B): restaurants, retailers, logistics companies and site operators. Sole traders are welcome — the Terms of service explain the extra protections that apply to them.'],
          l: [['terms', 'Terms of service']], c: ['pricing', 'demo']
        },
        privacy: {
          k: ['data', 'gdpr', 'privacy', 'cookie', 'rodo', 'personal data'],
          a: ['This chat is a demo: your messages stay in your browser tab and are deleted when you close it. Nothing is sent to us.', 'Data from the contact form is used only to answer your enquiry. Details are in the Privacy policy.'],
          l: [['privacy', 'Privacy policy'], ['cookies', 'Cookie policy']], c: ['human']
        },
        demo: {
          k: ['demo', 'meeting', 'book', 'present', 'trial', 'pilot', 'test', 'start', 'sign'],
          a: ['Happy to set that up. The demo is a 30-minute video call with a coverage check for your area, followed by a pilot plan with clear net prices — no obligation.', 'Fill in the short form and we’ll reply within one business day.'],
          l: [['contact', 'Book a demo']], c: ['pricing', 'live']
        },
        live: {
          k: ['panel', 'dashboard', 'interface', 'screen', 'app', 'fleet', 'try'],
          a: ['You can try a working fleet dashboard right now on simulated data: create deliveries, watch robots on the map, test webhooks and CSV import.'],
          l: [['app', 'Open the live panel']], c: ['integration', 'demo']
        },
        human: {
          k: ['human', 'person', 'agent', 'someone', 'consultant', 'support', 'contact', 'email', 'mail', 'phone', 'call', 'talk', 'speak', 'sales'],
          a: ['Of course. Our team replies within one business day:'],
          contact: true, l: [['contact', 'Contact form']], c: []
        }
      }
    },
    pl: {
      chips: {
        pricing: 'Cennik', how: 'Jak to działa', coverage: 'Gdzie działacie?',
        integration: 'Integracja i API', track: 'Śledź dostawę', food: 'Ciepłe jedzenie?',
        safety: 'Bezpieczeństwo', demo: 'Umów demo', human: 'Rozmowa z człowiekiem', live: 'Wypróbuj panel',
        b2b: 'Kto może zamówić?', privacy: 'Twoje dane', hours: 'Godziny pracy', permits: 'Zezwolenia'
      },
      greeting: ['Cześć, jestem Nova 👋', 'Odpowiem na najczęstsze pytania o roboty DeliveryNextGen, plany i integrację. W czym mogę pomóc?'],
      start: ['pricing', 'how', 'track', 'integration', 'human'],
      fallback: [
        ['Nie jestem pewna, czy dobrze rozumiem. Jestem asystentką demo z ograniczonym zestawem odpowiedzi.', 'Wybierz jeden z tematów albo napisz bezpośrednio do zespołu:'],
        ['Przepraszam, tego nie obsłużę w wersji demo.', 'Pomoże Ci ktoś z naszego zespołu — odpowiadamy w ciągu jednego dnia roboczego.']
      ],
      track: {
        ask: ['Jasne. Wpisz numer dostawy — w tym demo zadziała dowolny, np. 4821.'],
        bad: ['To nie wygląda na numer dostawy. Wpisz same cyfry, np. 4821 — albo „anuluj”.'],
        cancel: ['Nie ma sprawy. Coś jeszcze?'],
        states: [
          ['Dostawa #{id} jest w drodze. 🤖', 'Robot jest {d} przecznice stąd, dotrze za około {m} min. Klient dostaje jednorazowy PIN do otwarcia schowka.'],
          ['Dostawa #{id} została doręczona. ✅', 'Schowek otwarto PIN-em {m} min temu. Robot wraca do bazy.'],
          ['Dostawa #{id} jest w przygotowaniu.', 'Robot został przydzielony i wyjedzie z bazy za około {m} min.']
        ],
        note: 'Status symulowany — demo nie jest połączone z prawdziwymi dostawami.'
      },
      intents: {
        greet: { k: ['czesc', 'hej', 'witam', 'witaj', 'dzien dobry', 'dobry', 'siema', 'elo', 'hello', 'hi'], a: ['Cześć! W czym mogę pomóc?'], c: ['pricing', 'how', 'demo'] },
        thanks: { k: ['dzieki', 'dziekuj', 'super', 'swietn', 'ok', 'spoko', 'fajn'], a: ['Proszę bardzo! Mogę pomóc w czymś jeszcze?'], c: ['demo', 'human'] },
        bye: { k: ['pa', 'nara', 'zegnam', 'do widzenia', 'na razie'], a: ['Dzięki za wizytę. Miłego dnia!'], c: [] },
        pricing: {
          k: ['cen', 'koszt', 'kosztuj', 'ile', 'plan', 'abonament', 'oplat', 'eur', 'euro', 'starter', 'growth', 'enterprise', 'tani', 'drog', 'budzet', 'plac'],
          a: ['Mamy trzy plany (ceny netto, bez VAT):', '• Starter — 299 €/mies., do 300 dostaw, 1 robot\n• Growth — 799 €/mies., do 1000 dostaw, 3 roboty, tryb restauracyjny\n• Enterprise — wycena indywidualna, bez limitu dostaw, cała flota, SLA', 'W cenniku jest kalkulator, który pokaże koszt jednej dostawy przy Twoim wolumenie.'],
          l: [['pricing', 'Cennik i kalkulator']], c: ['demo', 'b2b']
        },
        how: {
          k: ['jak', 'dzial', 'robot', 'autonom', 'technolog', 'czujnik', 'jezdz', 'jedzie', 'nawigac'],
          a: ['Tworzysz zlecenie (API, wtyczka albo panel), dyspozytor przydziela najbliższego robota, a ten sam dojeżdża pod adres. Klient śledzi go na żywo i otwiera schowek jednorazowym PIN-em.', 'Jeśli robot nie poradzi sobie z sytuacją, operator w centrum operacyjnym przejmuje sterowanie zdalnie w kilka sekund.'],
          l: [['how', 'Jak to działa']], c: ['safety', 'track', 'live']
        },
        coverage: {
          k: ['miast', 'gdzie', 'obszar', 'region', 'okolic', 'dostepn', 'hiszpan', 'polsk', 'kraj', 'madryt', 'barcelon', 'walencj', 'warszaw', 'krakow', 'zasieg', 'dzialac'],
          a: ['Działamy w Hiszpanii i obsługujemy wszystkie duże miasta. Roboty są projektowane na wąskie uliczki, strefy piesze, osiedla zamknięte i pagórkowaty teren.', 'Zasięg zależy od lokalnych przepisów, dlatego dokładny obszar potwierdzamy podczas demo — zanim cokolwiek podpiszesz.'],
          l: [['contact', 'Sprawdź mój obszar']], c: ['permits', 'demo']
        },
        integration: {
          k: ['api', 'integrac', 'zintegr', 'webhook', 'wtyczk', 'plugin', 'shopify', 'woocommerce', 'magento', 'csv', 'polacz', 'podlacz', 'wdroz', 'programist', 'dokumentac', 'sdk', 'rest'],
          a: ['Większość integracji działa po około 48 godzinach. Możesz użyć REST API z webhookami, wtyczek do popularnych platform e-commerce, importu CSV albo panelu bez kodowania do ręcznego zlecania.', 'Nasz zespół przeprowadzi Cię przez konfigurację. Widok integracji możesz obejrzeć w panelu demo.'],
          l: [['app_integrations', 'Otwórz demo integracji']], c: ['live', 'demo']
        },
        trackinfo: {
          k: ['sledz', 'sledzenie', 'link', 'pin', 'powiadom', 'sms', 'eta'],
          a: ['Klienci dostają link ze śledzeniem pozycji robota na żywo i szacowaną godziną dotarcia, a do tego jednorazowy PIN do otwarcia schowka.'],
          c: ['track', 'live']
        },
        food: {
          k: ['ciepl', 'goracy', 'gorac', 'jedzen', 'restaurac', 'temperatur', 'pizz', 'posil', 'zimn', 'spozyw', 'izolac'],
          a: ['Tak. Plany Growth i Enterprise mają tryb restauracyjny: izolowany schowek utrzymujący temperaturę i priorytetową kolejkę dla krótkich okien dostaw.'],
          l: [['solutions', 'Rozwiązania dla branż']], c: ['pricing', 'demo']
        },
        hours: {
          k: ['godzin', '24', 'noc', 'weekend', 'niedziel', 'kiedy', 'zmian', 'ladowa', 'bateri'],
          a: ['Wszystkie plany obejmują autonomiczną pracę 24/7. Między zleceniami roboty same jadą do stacji ładowania, więc flota jest gotowa, gdy tylko pojawią się zamówienia.'],
          c: ['pricing', 'how']
        },
        safety: {
          k: ['bezpiecz', 'przeszkod', 'wypad', 'kradz', 'ukrad', 'wandal', 'zderz', 'piesz', 'zamk'],
          a: ['Roboty wykrywają przeszkody w czasie rzeczywistym i same zmieniają trasę. Gdy nie mogą rozwiązać sytuacji, operator przejmuje sterowanie zdalnie w kilka sekund.', 'Ładunek jest zamknięty i otwiera się tylko jednorazowym PIN-em klienta.'],
          l: [['how', 'Budowa robota']], c: ['permits', 'demo']
        },
        permits: {
          k: ['zezwol', 'pozwol', 'przepis', 'prawo', 'prawn', 'regulac', 'licenc', 'legaln', 'ubezpiecz'],
          a: ['Przepisy różnią się w zależności od miasta i kraju. Zezwoleniami i zgodnością zajmujemy się sami na rynkach, na których działamy, a zasięg dla Twojej okolicy potwierdzamy podczas demo.'],
          l: [['legal', 'Nota prawna']], c: ['coverage', 'demo']
        },
        b2b: {
          k: ['konsument', 'osob', 'b2b', 'firm', 'przedsiebior', 'jdg', 'dzialalnos', 'kto', 'prywatny', 'prywatna', 'prywatnej', 'prywatnych'],
          a: ['Pracujemy wyłącznie z firmami (B2B): restauracjami, sklepami, firmami logistycznymi i zarządcami terenów. JDG są mile widziane — regulamin opisuje dodatkową ochronę, która im przysługuje.'],
          l: [['terms', 'Regulamin']], c: ['pricing', 'demo']
        },
        privacy: {
          k: ['dane', 'danych', 'rodo', 'gdpr', 'prywatnos', 'cookie', 'ciaster', 'przechow'],
          a: ['Ten czat to demo: wiadomości zostają w karcie Twojej przeglądarki i znikają po jej zamknięciu. Nic do nas nie trafia.', 'Dane z formularza kontaktowego służą tylko do odpowiedzi na zapytanie. Szczegóły w polityce prywatności.'],
          l: [['privacy', 'Polityka prywatności'], ['cookies', 'Polityka cookies']], c: ['human']
        },
        demo: {
          k: ['demo', 'spotkan', 'rozmow', 'umow', 'prezentac', 'pokaz', 'pilotaz', 'test', 'zacz', 'start'],
          a: ['Chętnie. Demo to 30-minutowa rozmowa wideo ze sprawdzeniem zasięgu w Twojej okolicy, a potem plan pilotażu z jasnymi cenami netto — bez zobowiązań.', 'Wypełnij krótki formularz, a odpowiemy w ciągu jednego dnia roboczego.'],
          l: [['contact', 'Umów demo']], c: ['pricing', 'live']
        },
        live: {
          k: ['panel', 'dashboard', 'interfejs', 'ekran', 'aplikac', 'flot', 'wyprobuj', 'sprobowac'],
          a: ['Działający panel floty możesz wypróbować od razu na symulowanych danych: tworzysz dostawy, obserwujesz roboty na mapie, testujesz webhooki i import CSV.'],
          l: [['app', 'Otwórz panel demo']], c: ['integration', 'demo']
        },
        human: {
          k: ['czlowiek', 'osob', 'konsultant', 'pracownik', 'kontakt', 'mail', 'email', 'telefon', 'zadzwon', 'porozmawia', 'handlow', 'sprzedaz', 'pomoc'],
          a: ['Jasne. Nasz zespół odpowiada w ciągu jednego dnia roboczego:'],
          contact: true, l: [['contact', 'Formularz kontaktowy']], c: []
        }
      }
    }
  }[LANG];

  var TRACK_WORDS = LANG === 'pl'
    ? ['gdzie jest', 'moja paczk', 'moje zamow', 'moja dostaw', 'status', 'sledz dostaw', 'numer dostaw']
    : ['where is my', 'my order', 'my package', 'my parcel', 'my delivery', 'status', 'track my', 'track a', 'track delivery'];
  var CANCEL_WORDS = LANG === 'pl' ? ['anuluj', 'stop', 'nie', 'wroc'] : ['cancel', 'stop', 'no', 'back'];

  // ------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/ł/g, 'l')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svg(path) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    path.split('|').forEach(function (d) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      s.appendChild(p);
    });
    return s;
  }

  var ICON = {
    chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5v-9Z|M8.5 9.5h.01M12 9.5h.01M15.5 9.5h.01',
    close: 'm6 6 12 12M18 6 6 18',
    send: 'M4 12 20 4l-6 16-2.5-6.5L4 12Z',
    reset: 'M4 12a8 8 0 1 0 2.4-5.7L4 8.5|M4 4v4.5h4.5',
    arrow: 'M5 12h14M13 6l6 6-6 6'
  };

  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* storage blocked: chat still works */ }
  }
  function load() {
    try {
      var s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (s && Array.isArray(s.log)) return s;
    } catch (e) { /* ignore */ }
    return null;
  }

  var state = load() || { log: [], open: false, mode: '', misses: 0, teased: false };

  // ------------------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------------------
  var launcher = el('button', 'chat-launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', UI.open);
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'chat-panel');
  var lIconOpen = svg(ICON.chat); lIconOpen.setAttribute('class', 'i-open');
  var lIconClose = svg(ICON.close); lIconClose.setAttribute('class', 'i-close');
  var badge = el('span', 'chat-badge', '1'); badge.setAttribute('aria-hidden', 'true'); badge.hidden = true;
  launcher.appendChild(lIconOpen); launcher.appendChild(lIconClose); launcher.appendChild(badge);

  var teaser = el('div', 'chat-teaser');
  teaser.hidden = true;
  var teaserBtn = el('button', 'chat-teaser-text', UI.teaser); teaserBtn.type = 'button';
  var teaserX = el('button', 'chat-teaser-x'); teaserX.type = 'button'; teaserX.setAttribute('aria-label', UI.dismiss);
  teaserX.appendChild(svg(ICON.close));
  teaser.appendChild(teaserBtn); teaser.appendChild(teaserX);

  var panel = el('section', 'chat-panel');
  panel.id = 'chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'chat-title');
  panel.hidden = true;

  var head = el('header', 'chat-head');
  var avatar = el('span', 'chat-avatar'); avatar.setAttribute('aria-hidden', 'true');
  avatar.appendChild(el('i')); avatar.appendChild(el('i'));
  var titles = el('div', 'chat-titles');
  var title = el('h2', 'chat-title'); title.id = 'chat-title';
  title.textContent = UI.name + ' ';
  title.appendChild(el('span', 'chat-role', 'DeliveryNextGen'));
  var status = el('p', 'chat-status', UI.status);
  titles.appendChild(title); titles.appendChild(status);
  var resetBtn = el('button', 'chat-icon-btn'); resetBtn.type = 'button'; resetBtn.setAttribute('aria-label', UI.reset); resetBtn.title = UI.reset;
  resetBtn.appendChild(svg(ICON.reset));
  var closeBtn = el('button', 'chat-icon-btn'); closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', UI.close); closeBtn.title = UI.close;
  closeBtn.appendChild(svg(ICON.close));
  head.appendChild(avatar); head.appendChild(titles); head.appendChild(resetBtn); head.appendChild(closeBtn);

  var log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-relevant', 'additions');
  log.tabIndex = 0;

  var typing = el('div', 'chat-msg chat-msg--bot chat-typing');
  typing.setAttribute('aria-label', UI.typing);
  typing.appendChild(el('span')); typing.appendChild(el('span')); typing.appendChild(el('span'));

  var form = el('form', 'chat-form');
  form.setAttribute('novalidate', '');
  var label = el('label', 'sr-only', UI.label); label.htmlFor = 'chat-input';
  var input = el('input', 'chat-input');
  input.id = 'chat-input'; input.type = 'text'; input.autocomplete = 'off';
  input.maxLength = 300; input.placeholder = UI.placeholder;
  input.setAttribute('enterkeyhint', 'send');
  var sendBtn = el('button', 'chat-send'); sendBtn.type = 'submit'; sendBtn.setAttribute('aria-label', UI.send);
  sendBtn.appendChild(svg(ICON.send));
  form.appendChild(label); form.appendChild(input); form.appendChild(sendBtn);

  var note = el('p', 'chat-note', UI.note);

  panel.appendChild(head); panel.appendChild(log); panel.appendChild(form); panel.appendChild(note);
  mount.appendChild(teaser); mount.appendChild(panel); mount.appendChild(launcher);
  mount.hidden = false;
  document.body.classList.add('has-chat');

  // ------------------------------------------------------------------------
  // Rendering. Messages are stored as data and re-rendered on each page.
  //   { from: 'bot'|'me', p: [text...], l: [[key,label]], c: [intent], contact, note }
  // ------------------------------------------------------------------------
  function renderMsg(m, animate) {
    var wrap = el('div', 'chat-msg chat-msg--' + m.from + (animate && !reduceMotion ? ' is-new' : ''));
    var who = el('span', 'sr-only', (m.from === 'me' ? UI.you : UI.bot) + ': ');
    var bubble = el('div', 'chat-bubble');
    bubble.appendChild(who);
    (m.p || []).forEach(function (t) { bubble.appendChild(el('p', null, t)); });
    if (m.contact) {
      var ul = el('ul', 'chat-contact');
      if (EMAIL) { var li1 = el('li'); var a1 = el('a', null, EMAIL); a1.href = 'mailto:' + EMAIL; li1.appendChild(a1); ul.appendChild(li1); }
      if (PHONE) { var li2 = el('li'); var a2 = el('a', null, PHONE); a2.href = 'tel:' + PHONE.replace(/[^\d+]/g, ''); li2.appendChild(a2); ul.appendChild(li2); }
      bubble.appendChild(ul);
    }
    if (m.note) bubble.appendChild(el('p', 'chat-small', m.note));
    wrap.appendChild(bubble);

    if (m.l && m.l.length) {
      var links = el('div', 'chat-links');
      m.l.forEach(function (pair) {
        var url = LINKS[pair[0]];
        if (!url) return;
        var a = el('a', 'chat-link', pair[1]);
        a.href = url;
        a.appendChild(svg(ICON.arrow));
        links.appendChild(a);
      });
      if (links.childNodes.length) wrap.appendChild(links);
    }
    return wrap;
  }

  function renderChips(ids) {
    var old = log.querySelector('.chat-chips');
    if (old) old.remove();
    if (!ids || !ids.length) return;
    var box = el('div', 'chat-chips');
    ids.forEach(function (id) {
      if (!KB.chips[id]) return;
      var b = el('button', 'chat-chip', KB.chips[id]);
      b.type = 'button';
      b.setAttribute('data-intent', id);
      box.appendChild(b);
    });
    log.appendChild(box);
  }

  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function renderAll() {
    log.textContent = '';
    state.log.forEach(function (m) { log.appendChild(renderMsg(m, false)); });
    var last = state.log[state.log.length - 1];
    if (last && last.from === 'bot') renderChips(last.c);
    scrollDown();
  }

  // ------------------------------------------------------------------------
  // Bot logic
  // ------------------------------------------------------------------------
  function has(text, words) {
    var padded = ' ' + text + ' ';
    return words.some(function (w) { return padded.indexOf(' ' + w) !== -1; });
  }

  function classify(raw) {
    var text = norm(raw);
    if (!text) return null;
    if (has(text, TRACK_WORDS)) return 'track';
    var words = text.split(' ');
    var best = null, bestScore = 0;
    Object.keys(KB.intents).forEach(function (id) {
      var score = 0;
      KB.intents[id].k.forEach(function (k) {
        if (k.indexOf(' ') !== -1) { if (has(text, [k])) score += 2; return; }
        for (var i = 0; i < words.length; i++) {
          var w = words[i];
          // short keys (ok, pa, 24, hi) must match whole words
          if (k.length <= 3 ? w === k : w.indexOf(k) === 0) { score += k.length > 5 ? 1.5 : 1; break; }
        }
      });
      // small talk loses ties against real topics
      if (score && (id === 'greet' || id === 'thanks' || id === 'bye')) score -= 0.5;
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return bestScore >= 0.5 ? best : null;
  }

  function fill(t, vars) {
    return t.replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; });
  }

  function trackReply(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    var st = KB.track.states[h % KB.track.states.length];
    var vars = { id: id, m: 2 + (h % 14), d: 2 + (h % 5) };
    return { from: 'bot', p: st.map(function (t) { return fill(t, vars); }), note: KB.track.note, c: ['track', 'live', 'demo'] };
  }

  function answer(intentId) {
    if (intentId === 'track') {
      state.mode = 'track';
      return { from: 'bot', p: KB.track.ask, c: [] };
    }
    var it = KB.intents[intentId];
    state.misses = 0;
    return { from: 'bot', p: it.a, l: it.l, c: it.c, contact: !!it.contact };
  }

  function reply(userText) {
    var text = norm(userText);
    if (state.mode === 'track') {
      var num = text.replace(/[^0-9]/g, '');
      if (num.length >= 2 && num.length <= 10) { state.mode = ''; return trackReply(num); }
      if (has(text, CANCEL_WORDS)) { state.mode = ''; return { from: 'bot', p: KB.track.cancel, c: KB.start }; }
      var other = classify(userText);
      if (!other) return { from: 'bot', p: KB.track.bad, c: [] };
      state.mode = '';
      return answer(other);
    }
    var id = classify(userText);
    var digits = text.replace(/[^0-9]/g, '');
    if (id === 'track' && digits.length >= 2 && digits.length <= 10) { state.misses = 0; return trackReply(digits); }
    if (id) return answer(id);
    state.misses += 1;
    var fb = KB.fallback[Math.min(state.misses, KB.fallback.length) - 1];
    return state.misses > 1
      ? { from: 'bot', p: fb, contact: true, l: [['contact', KB.intents.human.l[0][1]]], c: ['pricing', 'how', 'demo'] }
      : { from: 'bot', p: fb, c: ['pricing', 'how', 'integration', 'human'] };
  }

  var busy = false;
  function push(m, animate) {
    state.log.push(m);
    if (state.log.length > 60) state.log = state.log.slice(-60);
    save();
    var chips = log.querySelector('.chat-chips');
    if (chips) chips.remove();
    log.appendChild(renderMsg(m, animate));
    if (m.from === 'bot') renderChips(m.c);
    scrollDown();
  }

  function botSay(m) {
    busy = true;
    log.appendChild(typing);
    scrollDown();
    var words = (m.p || []).join(' ').split(' ').length;
    var delay = reduceMotion ? 150 : Math.min(1400, 450 + words * 18);
    setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      push(m, true);
      busy = false;
      if (!state.open) { badge.hidden = false; }
    }, delay);
  }

  function userSay(text, intent) {
    if (busy) return;
    push({ from: 'me', p: [text] }, true);
    var m = intent ? answer(intent) : reply(text);
    save();
    botSay(m);
  }

  function greet() {
    state.log = [];
    state.mode = '';
    state.misses = 0;
    log.textContent = '';
    botSay({ from: 'bot', p: KB.greeting, c: KB.start });
  }

  // ------------------------------------------------------------------------
  // Open / close
  // ------------------------------------------------------------------------
  var lastFocus = null;
  function setOpen(open, focus) {
    state.open = open;
    save();
    panel.hidden = !open;
    mount.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? UI.close : UI.open);
    if (open) {
      hideTeaser();
      badge.hidden = true;
      if (!state.log.length) greet(); else renderAll();
      lastFocus = document.activeElement;
      if (focus !== false) setTimeout(function () { input.focus({ preventScroll: true }); }, 30);
    } else if (focus !== false) {
      (lastFocus && document.contains(lastFocus) ? lastFocus : launcher).focus();
    }
  }

  function hideTeaser() {
    teaser.hidden = true;
    state.teased = true;
    save();
  }

  launcher.addEventListener('click', function () { setOpen(!state.open); });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  resetBtn.addEventListener('click', function () { if (!busy) { greet(); input.focus(); } });
  teaserBtn.addEventListener('click', function () { setOpen(true); });
  teaserX.addEventListener('click', hideTeaser);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.replace(/\s+/g, ' ').trim();
    if (!text || busy) return;
    input.value = '';
    userSay(text.slice(0, 300));
  });

  log.addEventListener('click', function (e) {
    var chip = e.target.closest('.chat-chip');
    if (!chip || busy) return;
    var id = chip.getAttribute('data-intent');
    userSay(KB.chips[id], id);
    input.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.open && (panel.contains(document.activeElement) || document.activeElement === launcher)) {
      setOpen(false);
    }
  });

  // Restore the state from the previous page of this tab
  if (state.open) {
    setOpen(true, false);
  } else if (!state.teased && !state.log.length) {
    // gentle hint once per tab, after the visitor has had time to look around
    setTimeout(function () {
      if (state.open || state.teased) return;
      teaser.hidden = false;
      badge.hidden = false;
    }, 9000);
  }
})();
