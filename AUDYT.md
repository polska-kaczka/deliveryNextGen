# DeliveryNextGen — audyt strony i opis wersji V2

Data: 19.10.2026 · Zakres: `public_html/` (wersja obecna) oraz nowa wersja w `V2/`

> **Ważne:** dokumenty prawne w V2 to rzetelnie przygotowane wzorce, ale nie zastępują porady prawnej.
> Przed publikacją daj je do przejrzenia prawnikowi (najlepiej znającemu prawo PL i ES) i uzupełnij dane firmy (lista w sekcji 5).

---

## 1. Podsumowanie

| Obszar | Obecna strona | V2 |
|---|---|---|
| Formularz kontaktowy | Działa w trybie podstawowym, ale ma błąd JS przy awarii sieci i lukę bezpieczeństwa (wstrzykiwanie nagłówków e-mail) | Przepisany: CSRF, limity, honeypot, pułapka czasowa, walidacja po obu stronach, obsłużone wszystkie stany |
| Bezpieczeństwo | Brak nagłówków bezpieczeństwa, CSP, wymuszenia HTTPS | Restrykcyjne CSP bez `unsafe-inline`, HSTS, ochrona przed clickjackingiem, blokada plików wrażliwych |
| Wymogi prawne | Brak polityki prywatności, noty prawnej, regulaminu, polityki cookies i klauzuli RODO przy formularzu | Komplet dokumentów EN + PL, klauzula informacyjna, oświadczenie B2B, ustawienia cookies |
| Struktura | 1 strona (one-page) | 12 podstron × 2 języki + strona 404 (25 plików) |
| Motion / storytelling | Proste fade-up, efekt „tilt” 3D | Historia jednej dostawy (21:47 → 22:03), sterowane scrollem animacje 2D, animacje tekstu, bez żadnych elementów 3D |
| Dostępność | Menu i FAQ nieobsługiwane klawiaturą, etykiety pól niepowiązane | Pełna obsługa klawiatury, ARIA, `prefers-reduced-motion`, kontrast AA |

---

## 2. Audyt obecnej strony (`public_html/`)

### 2.1 Błędy krytyczne / bezpieczeństwo

1. **Wstrzykiwanie nagłówków e-mail** (`send_lead.php`, linie 67–68 i 106). Imię i nazwisko trafiają do nagłówka `Reply-To`. `trim()` usuwa znaki nowej linii tylko z brzegów, a `strip_tags`/`htmlspecialchars` w ogóle ich nie usuwają. Imię zawierające `\r\nBcc: …` pozwala dopisać własne nagłówki, czyli wykorzystać serwer do wysyłania spamu.
2. **Błąd JS przy awarii sieci** (`index.html`, linia 2089). Blok `.catch` odwołuje się do nieistniejącej zmiennej `data`, więc rzuca `ReferenceError`. Użytkownik nie widzi komunikatu, a przycisk zostaje na zawsze w stanie „⏳ Sending request…”.
3. **Kody HTTP nie są ustawiane** (`send_lead.php`, linie 9–10, 33–35, 58–62). `echo` występuje przed `http_response_code()`, więc nagłówki są już wysłane. Do tego ostrzeżenie PHP może zepsuć odpowiedź JSON.
4. **Pozorne zabezpieczenia:**
   - „token JS” da się wyliczyć (`js_active_` + czas / 10), więc nie chroni przed botami;
   - sprawdzanie `Referer` przepuszcza żądania bez tego nagłówka;
   - limit wysyłek jest tylko w sesji, więc bot bez cookies go omija.
5. **Brak ochrony CSRF** i brak nagłówków bezpieczeństwa (CSP, HSTS, X-Frame-Options, nosniff). Nie ma `.htaccess` wymuszającego HTTPS.
6. **Ujawnianie wersji PHP** w nagłówku `X-Mailer`.
7. Komunikat błędu formularza nigdy nie jest chowany przy ponownej próbie. Po błędzie i późniejszym sukcesie widać jednocześnie oba stany.
8. Temat maila z emoji bez kodowania MIME, a encje HTML (`&#039;`) trafiają do maila tekstowego.

### 2.2 Braki prawne (RODO / UŚUDE / PKE / LSSI-CE)

1. **Brak polityki prywatności i klauzuli informacyjnej przy formularzu.** To naruszenie art. 13 RODO (obowiązek informacyjny w chwili zbierania danych).
2. **Brak noty prawnej z danymi firmy.** Wymagają tego art. 5 polskiej ustawy o świadczeniu usług drogą elektroniczną oraz art. 10 hiszpańskiej LSSI-CE.
3. **Brak regulaminu usług elektronicznych.** Art. 8 UŚUDE wymaga go już dla samego formularza kontaktowego.
4. **Brak polityki cookies.** Strona ustawia cookie sesyjne PHP; jest ono niezbędne, ale użytkownik musi zostać o nim poinformowany (art. 399 PKE, art. 22.2 LSSI).
5. **Google Fonts ładowane z serwerów Google** bez informacji w polityce. Adres IP trafia do Google; w 2022 r. sąd w Monachium uznał to za naruszenie RODO.
6. **Ceny bez oznaczenia netto/brutto i bez zastrzeżenia B2B,** a formularz ma opcję „Individual / other”. To zaprasza konsumentów, a wobec nich obowiązują ceny brutto i pełne prawo konsumenckie.
7. **Niepoparte twierdzenia marketingowe:** „−60% kosztów”, „0 emissions”, „15% of revenue”. W B2B grozi to zarzutem reklamy wprowadzającej w błąd (art. 16 ustawy o zwalczaniu nieuczciwej konkurencji). Wobec konsumentów byłaby to nieuczciwa praktyka rynkowa, a „zero emisji” to typowy przykład greenwashingu ścigany przez UOKiK.
8. Prywatny adres Gmail jako kontakt firmowy. Darmowy Gmail nie zapewnia umowy powierzenia (art. 28 RODO), więc do danych klientów potrzebna jest skrzynka firmowa (Google Workspace lub w domenie).

### 2.3 UX, dostępność, SEO

- **Menu mobilne:** ustawia style inline. Po otwarciu i zamknięciu na telefonie oraz zmianie szerokości na desktop zostaje `display:none`, więc nawigacja znika. Nie zamyka się po kliknięciu linku, a „hamburger” to `<div>` bez obsługi klawiatury.
- **FAQ:** pytania to `<div onclick>` bez obsługi klawiatury, a `max-height: 200px` może ucinać dłuższe odpowiedzi na telefonach.
- **Etykiety pól** nie są powiązane z polami (brak `for`/`id`).
- **Licznik „24/7”** animuje się jako „0/7 → 24/7”, a w kodzie jest martwe wywołanie `animateCounter`.
- **Kursor-kropka** pojawia się też na urządzeniach dotykowych. Brak obsługi `prefers-reduced-motion`.
- **Efekt „tilt”** kart używa transformacji 3D (`perspective`, `rotateX/Y`). W V2 usunięty zgodnie z wymaganiem „bez 3D”.
- **SEO:** brak `meta description`, Open Graph, favicony, `sitemap.xml`, `robots.txt` i strony 404. Copyright „2025”. Logo linkuje do `#`.
- **Treść:** w zespole są placeholdery („Robotics Lead”, „Ops Director” zamiast nazwisk).

---

## 3. Co zawiera V2

```
V2/
├── public_html/              ← to wgrywasz na serwer (zastępuje obecny public_html)
│   ├── index.html … (EN)     ← 12 stron EN
│   ├── pl/ …                 ← 12 stron PL
│   ├── 404.html              ← dwujęzyczna
│   ├── send_lead.php, csrf.php
│   ├── includes/             ← config.php, bootstrap.php (zablokowane z zewnątrz)
│   ├── assets/css, js, img
│   ├── .htaccess, .user.ini, robots.txt, sitemap.xml, .well-known/security.txt
├── src/                      ← źródła stron (szablon, sekcje, treści EN/PL)
├── build.py                  ← generator stron + dane firmy (COMPANY)
├── tools/dev_server.py       ← lokalny podgląd z mockiem PHP i tymi samymi nagłówkami CSP
├── tools/make_images.py      ← generuje og-image.png, logo.png, apple-touch-icon.png
└── AUDYT.md, README.md
```

**Podstrony (EN / PL):** Home/Start · How it works/Jak to działa · Solutions/Rozwiązania · Pricing/Cennik · About/O nas · FAQ · Contact/Kontakt · Legal notice/Nota prawna · Privacy policy/Polityka prywatności · Cookie policy/Polityka cookies · Terms/Regulamin · Accessibility/Dostępność · 404.

**Nowe elementy:** wybór języka z `hreflang`, galeria „najważniejsze w skrócie”, makieta aplikacji śledzenia w telefonie, makieta panelu floty, budowa robota z opisami na liniach prowadzących, przełącznik branż (segmented control), tabela porównania planów, kalkulator kosztu dostawy, FAQ z wyszukiwarką i filtrami, oś czasu „jak startujemy w mieście”, przypisy prawne w stopce, strona 404, okruszki nawigacyjne, drukowanie dokumentów prawnych / zapis do PDF.

### System wizualny (redesign v2.1, wzorowany na Apple / Google / Notion)

- **Typografia:** Inter (neutralny grotesk), nagłówki 600 z ujemnym trackingiem, treść 17 px / 1,47. Zamiast Syne, który był fontem typowym dla „AI-owych” stron.
- **Kolor:**
  - jeden akcent: morski cyjan `#007c99` do tekstu i przycisków (kontrast AA na bieli) oraz `#00d4f0` jako dekoracja;
  - fiolet i neonowe gradienty usunięte;
  - neutralne szarości ze skali `#1d1d1f / #6e6e73 / #f5f5f7`;
  - naprzemienne pasy jasne / szare / ciemne (`#080c10`, kolor marki z V1).
- **Układ:**
  - wyśrodkowane nagłówki, dużo powietrza (sekcje 96–168 px);
  - stała skala zaokrągleń: karty 28 px, elementy 18 px, przyciski-pigułki;
  - breakpointy 1068 / 734 px;
  - przypisy zebrane na dole strony, jak u Apple.
- **Nawigacja:** cienki, półprzezroczysty pasek, który automatycznie robi się ciemny nad ciemnymi sekcjami; menu mobilne pełnoekranowe.
- **Grafika zamiast zdjęć** (zgodnie z wyborem):
  - realistyczna ilustracja produktu w SVG: biały robot z ciemną szybą czujników, obracające się koła, świecący pasek statusu;
  - widok z przodu z opisami;
  - makiety prawdziwego interfejsu: telefon z mapą w stylu Apple Maps, panel floty z jeżdżącymi robotami;
  - spójne ilustracje branż.

**Storytelling (strona główna):**
- **Hero:** robot wjeżdża na scenę.
- **Manifest:** tekst podświetlany słowo po słowie podczas scrollowania.
- **Galeria** najważniejszych cech.
- **Przypięta historia jednego zamówienia (21:47 → 22:03):**
  - w telefonie robot jedzie po mapie, omija przeszkodę, a czas dotarcia odlicza się w dół;
  - na końcu wpisuje się PIN i schowek się otwiera.
- **Dalej:** platforma, liczby, branże, cennik, CTA.

**Motion design (wyłącznie 2D, powściągliwie):**
- Zostaje: kaskada słów w nagłówkach, łagodne pojawianie się sekcji, rysowanie linii, liczniki, skalowanie robota przy scrollu, galeria ze strzałkami, płynny wskaźnik zakładek, animowane FAQ i menu.
- Usunięte jako „gadżety”: kurtyna przejść, magnetyczne przyciski, poświata pod kursorem, przewijający się pasek z hasłami, szum tła.
- Nigdzie nie ma `perspective`, `rotateX/Y`, WebGL ani three.js. Przy włączonym „ogranicz ruch” animacje (także SVG) się wyłączają.

**Teksty** przepisane w tonie dużych marek: krótko, konkretnie, bez wykrzykników i pustych słów. Twierdzenia liczbowe mają przypisy.

---

## 4. Bezpieczeństwo V2

**Nagłówki HTTP (`.htaccess`):**
- restrykcyjny CSP: tylko własne skrypty, zero kodu inline, fonty wyłącznie z Bunny Fonts;
- HSTS (1 rok), `X-Frame-Options: DENY` + `frame-ancestors 'none'` (sprawdzone: wstawienie strony w ramkę jest blokowane);
- `nosniff`, `Referrer-Policy`, `Permissions-Policy` (kamera, mikrofon, lokalizacja, płatności wyłączone), COOP, CORP; usunięte `X-Powered-By` i `Server`.

**Dostęp do plików:**
- wymuszone HTTPS;
- blokada plików ukrytych (poza `/.well-known/`), kopii zapasowych, logów i plików konfiguracyjnych;
- wykonać można tylko `send_lead.php` i `csrf.php`; folder `includes/` jest zablokowany podwójnie (reguła w `.htaccess` + strażnik `DNG_APP` w kodzie);
- wyłączone listowanie katalogów i nietypowe metody HTTP.

**Formularz:**
- tylko POST z limitem rozmiaru;
- sprawdzenie pochodzenia (`Sec-Fetch-Site` / `Origin` / `Referer`) i token CSRF powiązany z sesją (`hash_equals`);
- cookie sesyjne `HttpOnly`, `Secure`, `SameSite=Strict`, tryb strict i regeneracja ID;
- honeypot i minimalny czas wypełnienia (boty dostają fałszywy „sukces”);
- 60 s przerwy między wysyłkami w sesji i maks. 5 wysyłek na godzinę z jednego IP; IP zapisywane wyłącznie jako skrót HMAC z solą, kasowany po godzinie (minimalizacja danych);
- walidacja i białe listy po stronie serwera, usuwanie znaków sterujących;
- w nagłówkach maila nie ma żadnego tekstu od użytkownika poza zwalidowanym adresem e-mail; temat kodowany MIME;
- błędy PHP nie są wyświetlane, tylko logowane.

**Frontend:**
- brak zewnętrznych skryptów (zero ryzyka ataku przez łańcuch dostaw CDN);
- formularz pobiera token dopiero przy pierwszej interakcji, więc cookie nie jest ustawiane przy wejściu na stronę;
- linki zewnętrzne z `rel="noopener"`.

**Inne:** `security.txt` (RFC 9116) i `robots.txt` wykluczający endpointy.

---

## 5. Zgodność prawna V2 i co MUSISZ zrobić przed publikacją

### 5.1 Co jest już zrobione
- **Nota prawna:** art. 5 UŚUDE, art. 10 LSSI-CE.
- **Polityka prywatności** (art. 13 RODO):
  - podstawy prawne rozpisane osobno dla firm i dla JDG;
  - okresy przechowywania, odbiorcy (hosting, poczta, fonty);
  - transfer do USA (EU-US Data Privacy Framework + SCC);
  - prawa użytkownika oraz organy nadzorcze PL (UODO) i ES (AEPD).
- **Polityka cookies:**
  - wykaz wszystkich technologii (`DNGSESSID`, `dng-consent`);
  - podstawy prawne: art. 5(3) dyrektywy ePrivacy, art. 399 PKE, art. 22.2 LSSI.
- **Regulamin usług elektronicznych** (art. 8 UŚUDE):
  - rodzaje usług, zawieranie i rozwiązywanie umów, wymagania techniczne;
  - szczególne zagrożenia (art. 6 UŚUDE), zakaz treści bezprawnych, reklamacje w 14 dni;
  - oferta B2B jako zaproszenie do zawarcia umowy (art. 71 KC);
  - **ochrona JDG na prawach konsumenta** (art. 385⁵ KC, art. 38a UPK).
- **Deklaracja dostępności** (dobrowolna; EAA nie obejmuje usług B2B).
- **Formularz:**
  - skrócona klauzula RODO przy formularzu (warstwowo + link do pełnej polityki);
  - wymagane oświadczenie B2B i potwierdzenie zapoznania się z polityką;
  - żadnych zaznaczonych z góry zgód ani zgód marketingowych.
- **Cookies bez „dark patterns”:**
  - obecnie są wyłącznie technologie niezbędne, więc baner nie jest wymagany i domyślnie się nie wyświetla;
  - menedżer zgód jest gotowy: gdy dodasz analitykę, wpisz `"analytics"` w `CONSENT_IN_USE` w `build.py`. Baner pojawi się wtedy automatycznie z równorzędnymi przyciskami „Odrzuć / Ustawienia / Akceptuj”, skrypty poczekają na zgodę, a cofnięcie zgody przeładuje stronę;
  - ustawienia cookies dostępne w każdej chwili z linku w stopce.
- **Ceny:** oznaczone jako netto, z informacją, że oferta jest tylko dla przedsiębiorców i że cennik to zaproszenie do zawarcia umowy, a nie oferta.
- **Twierdzenia marketingowe:**
  - „0 emissions” zmienione na „zero tailpipe emissions / zero emisji z rury wydechowej”;
  - „−60%” oznaczone jako szacunek z przypisem o metodologii;
  - usunięte niepotwierdzone „15% of revenue”.
- **Wersja polska** całej strony i dokumentów; przy rozbieżnościach dla użytkowników z Polski rozstrzyga wersja PL.

### 5.2 Do uzupełnienia (pola podświetlone na żółto na stronie)
W `V2/build.py`, słownik `COMPANY`:
- pełna nazwa firmy, forma prawna, adres siedziby, kraj;
- NIP / NIF / CIF, numer VAT UE, wpis do rejestru (KRS / CEIDG / Registro Mercantil), kapitał zakładowy;
- dostawca hostingu (nazwa i adres);
- prawo właściwe i sąd właściwy;
- zezwolenia na roboty w przestrzeni publicznej (jeśli wymagane).

Po uzupełnieniu uruchom `python build.py`. Skrypt wypisze, czego jeszcze brakuje.

Ręcznie w treści stron (oznaczone `mark.todo`):
- źródło / metodologia szacunku „−60%” (strona główna EN i PL) albo usuń tę liczbę;
- karta techniczna robota (Jak to działa);
- okres przechowywania logów u hostingodawcy (Polityka prywatności).

### 5.3 Działania poza kodem (ważne prawnie)
1. **Umowa powierzenia (DPA)** z hostingodawcą i dostawcą poczty. Zamień prywatny Gmail na skrzynkę firmową (Google Workspace z DPA albo poczta w domenie).
2. **Sól IP:** w `public_html/includes/config.php` ustaw `ip_salt` na losowy ciąg (instrukcja w pliku).
3. **Skrzynka nadawcy:** utwórz `noreply@twojadomena` i skonfiguruj SPF, DKIM i DMARC (inaczej maile z formularza trafią do spamu).
4. **Rejestr czynności przetwarzania** (art. 30 RODO): firma B2B przetwarzająca dane regularnie zwykle musi go prowadzić.
5. **Roboty na chodnikach:** w Polsce prawo o ruchu drogowym nie przewiduje dziś wprost autonomicznych robotów dostawczych na chodnikach. Przed ofertą na rynek PL **zweryfikuj to z prawnikiem**; w Hiszpanii zasady ustalają poszczególne miasta (ordenanzas municipales).
6. **Przegląd prawny** wszystkich dokumentów przed publikacją.
7. **Fonty (opcjonalnie):** Bunny Fonts (UE, bez cookies) jest opisane w polityce. Jeszcze lepiej hostować fonty lokalnie; wtedy usuń Bunny z polityki prywatności, polityki cookies i CSP.

### 5.4 UOKiK, w skrócie
UOKiK chroni głównie **konsumentów**. Strona jest jednoznacznie B2B, więc główne ryzyka konsumenckie odpadają:
- ceny brutto;
- 14 dni na odstąpienie dla konsumentów (poza JDG, opisanymi w regulaminie);
- dyrektywa Omnibus (najniższa cena z 30 dni) — na stronie nie ma promocji.

Pozostają do pilnowania:
- **wprowadzające w błąd twierdzenia** (szczególnie ekologiczne);
- **uczciwy baner cookies**, jeśli kiedyś zostanie włączony (gotowe, bez dark patterns);
- **przejrzystość cen.**

Wszystkie trzy punkty są zaadresowane w V2.

---

## 6. Weryfikacja wykonana

- **Generowanie:** 25 stron bez błędów.
- **Analiza statyczna kodu HTML:**
  - zero atrybutów `style` i skryptów inline (zgodność z CSP);
  - zero zepsutych linków wewnętrznych;
  - poprawne `aria-controls`/`labelledby`/`describedby` i `label for`;
  - zbalansowane znaczniki, brak zduplikowanych ID.
- **Przeglądarka** (lokalny serwer z tymi samymi nagłówkami CSP):
  - brak naruszeń CSP w konsoli;
  - formularz: walidacja, prefill z URL (`?plan=growth&type=restaurant`), wysyłka z sukcesem, ścieżka błędu serwera (komunikat po PL, przycisk wraca do stanu aktywnego), token CSRF pobierany dopiero przy interakcji;
  - działają: kalkulator, FAQ (wyszukiwarka, filtry, rozwijanie), menu mobilne (Escape, fokus, etykieta ARIA), okno ustawień cookies, strona 404;
  - sekcja „podróż”: przypinanie, zegar, robot na trasie;
  - animacja PIN-u.
- Wszystkie 25 stron sprawdzone na szerokości 375 px: brak poziomego przewijania.
- **Nie przetestowano:** PHP (`send_lead.php`, `csrf.php`) — lokalnie nie ma interpretera PHP. Kod jest napisany pod PHP 7.4+ z rozszerzeniem mbstring i przejrzany ręcznie, ale **przetestuj formularz na serwerze** po wdrożeniu (sekcja 7).

---

## 7. Wdrożenie

1. Uzupełnij `COMPANY` w `V2/build.py` → `python build.py`.
2. Ustaw `ip_salt`, `from_address` i `allowed_hosts` w `V2/public_html/includes/config.php`.
3. Zrób kopię obecnego `public_html` na serwerze, a potem wgraj **zawartość** `V2/public_html/` (razem z ukrytymi plikami `.htaccess`, `.user.ini` i folderem `.well-known`).
4. Upewnij się, że katalog `dng-data` obok `public_html` (poza katalogiem publicznym) może zostać utworzony przez PHP. Jeśli nie, skrypt użyje katalogu tymczasowego.
5. Testy po wdrożeniu:
   - wysłanie formularza (EN i PL);
   - https://securityheaders.com i https://observatory.mozilla.org;
   - czy `https://domena/includes/config.php` zwraca 403/404.
6. Jeśli serwer nie obsługuje którejś dyrektywy `.htaccess` (błąd 500), zakomentuj ją i daj znać.

---

## 8. Poprawki wprowadzone w obecnej stronie (`public_html/`)

Wygląd bez zmian: cały HTML i CSS jest identyczny. Kopia plików sprzed zmian: `_backup_v1_2026-10-19/` (poza katalogiem publicznym).

**`send_lead.php`:**
- Kody HTTP są ustawiane przed treścią odpowiedzi, nagłówek JSON na samym początku, a błędy PHP nie trafiają do odpowiedzi.
- **Wstrzykiwanie nagłówków usunięte:**
  - znaki sterujące (CR/LF) wycinane ze wszystkich pól;
  - `Reply-To` zawiera wyłącznie zwalidowany e-mail;
  - domena nadawcy ograniczona do bezpiecznych znaków.
- Biała lista typów klienta, limit długości e-maila.
- Temat kodowany MIME.
- Treść maila bez encji HTML.
- Usunięty nagłówek `X-Mailer` z wersją PHP.

**`index.html` (tylko skrypt formularza):**
- `.catch` nie odwołuje się już do nieistniejącej zmiennej, więc przy awarii sieci pokazuje komunikat i odblokowuje przycisk.
- Komunikat błędu chowa się przy ponownej próbie.
- Obsłużona odpowiedź serwera, która nie jest JSON-em.

**Testy:** sprawdzone w przeglądarce z symulowanym serwerem: sukces, błąd serwera, odpowiedź nie-JSON, awaria sieci, sukces po błędzie. Samego PHP nie dało się uruchomić lokalnie.

---

## 9. Motion design ilustracji (v2.2)

Wszystko w kodzie (SVG + CSS + SMIL + JS), bez filmów, zdjęć i elementów 3D.

- **Robot (nowa ilustracja premium):**
  - perłowa obudowa z odblaskami, grafitowe podwozie z wahaczem, szczotkowane felgi z bieżnikiem;
  - przyciemniany wizjer ze świecącymi oczami LED, pasek świetlny ze skanującym refleksem, lidar, tylne światło, proporczyk z animacją materiału.
- **Rig w JS:**
  - koła obracają się proporcjonalnie do przejechanej drogi;
  - nadwozie na zawieszeniu drga na nierównościach;
  - przy hamowaniu nos się pochyla (sprężyna z tłumieniem).
- **Hero:**
  - scena miasta z 4 warstwami paralaksy (bezszwowe pętle generowane przez `tools/make_scene.py`);
  - robot wjeżdża, hamuje, po chwili rusza w trasę, a scrollowanie przyspiesza ruch miasta;
  - na ciemnych sekcjach ta sama scena w wersji nocnej.
- **Galeria:** 5 zapętlonych mikro-filmów (zaułek kontra bus, PIN, nocna zmiana, ładowanie, śledzenie z odliczaniem).
- **Branże:** 4 sceny z historią (restauracja, sklep, logistyka, kampus).
- **Panel floty:** działa „na żywo” (nowe zlecenia, zmiany statusów, licznik).
- **Mapa w telefonie:** kamera podąża za robotem, strzałka kierunku obraca się z trasą.
- **Budowa robota:** skaner w wizjerze i pulsujące punkty.
- **404:** zgubiony robot.
- **Przełącznik PL/EN:** animowany przełącznik w stylu iOS.
- **Wydajność:**
  - animacje działają tylko, gdy są na ekranie (IntersectionObserver wstrzymuje CSS, SMIL i pętle JS);
  - pomiar w podglądzie: 240 kl./s bez zgubionych klatek;
  - przy „ogranicz ruch” wszystko się zatrzymuje.

## 10. Motion design — dopracowanie (v2.3)

Założenia i układ bez zmian. Ulepszone tylko modele i animacje.

- **Jeden model, cztery widoki:**
  - robot z boku, z przodu, w miniaturze i z góry ma te same proporcje i materiały (`dng-defs.html`);
  - wcześniej miniatura i widok z góry były osobnymi, uproszczonymi rysunkami.
- **Nowe elementy robota:**
  - klapa schowka na zawiasie z izolowanym wnętrzem;
  - lidar na nosie (i na dachu w widoku z przodu) z obracającym się promieniem;
  - reflektory (w ciemnym motywie świecą na jezdnię), światło stopu;
  - czujniki w zderzaku, odblaski boczne, port ładowania, śruby felg, wahacz z przegubami.
- **Fizyka (JS):**
  - antena to tłumiona sprężyna: przy hamowaniu wychyla się do przodu, przy jeździe lekko odchyla na wietrze;
  - światło stopu zapala się proporcjonalnie do opóźnienia i łagodnie gaśnie.
- **Sceny branż:**
  - klapa otwiera się, paczka lub torba wpada do schowka, pasek świetlny zmienia kolor na zielony;
  - kółka obracają się dokładnie o przejechaną drogę, wyliczoną z długości trasy;
  - zamiast cofania na miejsce podjeżdża kolejny robot;
  - logistyka: bus z przesuwnymi drzwiami, kręcącymi się kołami i odjazdem;
  - restauracja: dzwonek nad drzwiami; kampus: fontanna z falami.
- **Galeria:**
  - „zasięg”: robot z góry, bus z kabiną i lusterkami, światła stopu i awaryjne;
  - „noc”: robot na jezdni, plamy światła latarni, kręcące się koła;
  - PIN: fala pod klawiszem;
  - bateria: pęcherzyki i wtyczka;
  - śledzenie: tykający zegar, pinezka celu z potwierdzeniem.
- **Ujednolicone:**
  - pinezki startu i celu, znacznik robota (telefon, panel floty, galeria) i paczki;
  - cel potwierdza dotarcie falą i ptaszkiem, także w telefonie w historii.
- **Miasto (hero):**
  - chmury (w nocy gwiazdy), okna zapalające się i gasnące;
  - stożki światła latarni, przystanek, hydrant, kosz, skrzynka, znak, studzienki;
  - zabudowa bez zmian, bo detale mają osobne ziarno losowości.
- Kopia wersji sprzed zmian: `../_backup_v2_przed-motion_2026-10-19/`.

