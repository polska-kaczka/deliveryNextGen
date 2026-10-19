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
