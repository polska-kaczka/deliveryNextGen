# DeliveryNextGen V2

Nowa wersja strony: statyczny HTML (EN + PL) generowany z szablonu, vanilla CSS/JS bez zależności, backend formularza w PHP.
Pełny audyt i lista rzeczy do uzupełnienia: [AUDYT.md](AUDYT.md).

## Konfiguracja serwera

Przed wdrożeniem skopiuj `public_html/includes/config.example.php` do `public_html/includes/config.php` i uzupełnij: adres odbiorcy zgłoszeń, adres nadawcy w domenie (SPF/DKIM), dozwolone domeny i losową sól `ip_salt`. Plik `config.php` jest w `.gitignore` i nigdy nie trafia do repozytorium.

## Edycja treści

- **Strona główna, Jak to działa, Rozwiązania, O nas:**
  - układ (wspólny dla obu języków): `src/pages/shared/<strona>.html`;
  - teksty: `src/i18n/en/<strona>.txt` i `src/i18n/pl/<strona>.txt`;
  - format tekstów: każdy blok zaczyna się od linii `@@ klucz`, a w szablonie wstawia się go tokenem `{{t:klucz}}`;
  - tytuł i opis SEO strony to klucze `meta.title` i `meta.description`, przypisy prawne — klucz `footnotes`;
  - teksty wspólne dla wielu stron (makieta panelu, przyciski): `common.txt`.
- **Cennik, FAQ, Kontakt, dokumenty prawne:** osobne pliki na język w `src/pages/en/*.html` i `src/pages/pl/*.html` (nagłówek `---` z tytułem i opisem SEO).
- **Wspólne sekcje:** `src/partials/<język>/` (formularz, CTA, plany) oraz `src/partials/shared/` (ilustracja robota, mapa w telefonie, panel floty, grafiki galerii i branż).
- **Jeden model robota w czterech widokach:** `robot-side` (bok), `robot-mini` (ta sama geometria w miniaturze), `robot-front` (przód), `robot-top` (z góry). Materiały (gradienty, filtry, cienie) są w jednym miejscu: `dng-defs.html`, wstawianym raz w `layout.html`. Wspólne elementy scen: `pin-origin`, `pin-dest`, `bot-marker`, `parcel`.
- Nawigacja, stopka, baner cookies: `src/layout.html` + teksty w `STR` w `build.py`.
- Dane firmy do noty prawnej, polityk i regulaminu: `COMPANY` w `build.py`.
- Style: `public_html/assets/css/main.css` · Skrypty: `public_html/assets/js/main.js`.

Po każdej zmianie w `src/` lub `build.py`:

```bash
python build.py
```

## Demo panelu (`/app/`)

Działający panel floty na symulowanych danych: `public_html/app/` (EN) i `public_html/pl/app/` (PL), podlinkowany pod makietą na stronie głównej i w stopce („Demo na żywo”).

- Szablon: `src/app/app.html`; teksty: `src/i18n/<język>/app.txt` (trafiają też do skryptu jako JSON).
- Logika: `public_html/assets/js/app.js` — siatka ulic z wyznaczaniem najkrótszej trasy, 14 robotów z baterią i ładowaniem, cykl dostawy (w kolejce → przydzielone → w trasie → dostarczone), integracje (API, webhooki, import CSV), zespół.
- Style: `public_html/assets/css/app.css` (korzysta z tokenów z `main.css`).
- Widoki (routing po `#`): Przegląd, Dostawy, Flota, Integracje, Zespół. Skróty: `N` nowa dostawa, `/` szukaj, `Esc` zamknij.
- Dane zapisują się tylko w `localStorage` przeglądarki (klucz `dng-demo-v1`); „Resetuj demo” w panelu bocznym przywraca stan początkowy. Brak zapytań sieciowych, zgodne z CSP (bez stylów i skryptów inline).

## Prezentacja na demo day (`/present/`)

Animowany „film” o produkcie przed przeklikaniem strony: `/present/` (EN) i `/pl/present/` (PL), ok. 2 min 10 s, 11 scen (start, problem, robot, budowa, jedna dostawa, platforma, integracje, bezpieczeństwo, liczby, branże, finał z przejściem do strony i panelu demo). Strona ma `noindex` i nie jest podlinkowana w menu.

- Szablon: `src/present/present.html`; teksty i notatki prelegenta: `src/i18n/<język>/present.txt` (plus teksty z `home.txt` i `how.txt` z prefiksem `how.`).
- Logika: `public_html/assets/js/present.js` (jeden zegar z pauzą steruje wszystkimi animacjami); style: `public_html/assets/css/present.css`. Długość scen: atrybut `data-dur` w szablonie.
- Sterowanie: Spacja / → / PageDown (pilot do prezentacji) dalej, ← wstecz, P pauza, 1–9 i 0 skok do sceny, R od początku, F pełny ekran, N okno notatek (synchronizuje się samo), L pętla, H ukryj pasek, ? pomoc. Klik w lewą/prawą część ekranu też przełącza sceny.
- Parametry adresu: `?autostart` (bez ekranu startowego), `?loop` (pętla na stoisko), `?scene=5` (start od sceny), `?nofs` (bez pełnego ekranu).
- Działa bez internetu po załadowaniu strony (bez zewnętrznych skryptów, fonty mają zapasowy krój systemowy).

## Czat pomocy (demo)

Dymek czatu w prawym dolnym rogu na wszystkich stronach (EN + PL). Działa bez API i bez zapytań sieciowych: gotowe odpowiedzi dobierane po słowach kluczowych.

- Logika i baza odpowiedzi: `public_html/assets/js/chat.js` (obiekt `KB`, osobno `en` i `pl`). Każdy temat ma listę początków słów (`k`, bez polskich znaków), odpowiedź (`a`), przyciski z linkami do podstron (`l`) i podpowiedzi kolejnych tematów (`c`).
- Style: `public_html/assets/css/chat.css`. Punkt montowania i linki do podstron: `src/layout.html` + `chat_links` w `build.py`.
- Funkcje: powitanie z podpowiedziami, „pisze…”, symulowane śledzenie dostawy (dowolny numer), przekazanie do człowieka (e-mail, telefon, formularz), jednorazowa zachęta po 9 s, rozmowa zachowana przy przechodzeniu między stronami (`sessionStorage`, klucz `dng-chat`, opisany w polityce cookies).
- Bezpieczeństwo: tekst wstawiany wyłącznie przez `textContent`, zgodne z CSP, nic nie opuszcza przeglądarki.

## Scena miasta (hero)

Warstwy paralaksy generuje skrypt (zmiana zabudowy, kolorów, ziarna losowości):

```bash
python tools/make_scene.py
python build.py
```

## Podgląd lokalny

```bash
python tools/dev_server.py 8765
```

Strona będzie dostępna pod http://localhost:8765. Serwer wysyła te same nagłówki bezpieczeństwa (CSP) co `.htaccess` i symuluje PHP:
- wiadomość z formularza zawierająca słowo `fail` zwraca błąd serwera;
- słowo `slow` wydłuża odpowiedź o 2 s.

## Tokeny w szablonach

| Token | Znaczenie |
|---|---|
| `{{t:hero.title}}` | tekst z pliku `src/i18n/<język>/<strona>.txt` |
| `{{url:pricing}}` | link do podstrony w bieżącym języku |
| `{{c.name}}` | dana firmy (placeholder podświetlany na żółto) |
| `{{raw.email}}` | dana firmy bez podświetlenia |
| `{{icon:lock}}` | ikona SVG |
| `{{partial:form}}` | sekcja z `src/partials/<język>/` |
| `{{shared:phone-map}}` | sekcja z `src/partials/shared/` |
| `{{s.cta}}` | tekst interfejsu z `STR` |
| `{{updated}}` | data dokumentów prawnych |

## Cookies / analityka

Strona używa tylko technologii niezbędnych, więc baner się nie pokazuje. Żeby dodać analitykę:

1. W `build.py` ustaw `CONSENT_IN_USE = ["analytics"]`.
2. Skrypt dodaj jako:

   ```html
   <script type="text/plain" data-consent="analytics" data-src="/assets/js/analytics.js"></script>
   ```

   Skrypt musi być lokalny albo dopisany do CSP w `.htaccess`.
3. Uzupełnij tabelę w polityce cookies (EN i PL) i zbuduj stronę ponownie.
