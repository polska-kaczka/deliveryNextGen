#!/usr/bin/env python3
"""
DeliveryNextGen V2 — static site builder (Python 3.8+, no dependencies).

    python build.py

Reads   src/layout.html, src/partials/<lang>/*.html, src/pages/<lang>/*.html
Writes  public_html/*.html (EN) and public_html/pl/*.html (PL),
        public_html/sitemap.xml

Fill in COMPANY below. Empty values are hidden on the site and listed at the end
of the build so nothing is missed; a value starting with "[" would be rendered
as a highlighted <mark class="todo">.
"""
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent
SRC = BASE / "src"
OUT = BASE / "public_html"

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
SITE_URL = "https://deliverynextgen.threecode.eu"   # no trailing slash
ASSET_VERSION = "2.2.0"                              # bump to bust caches
DOCS_UPDATED = "18.10.2026"                          # date of the legal documents

# Non-essential cookie categories actually in use. Leave empty while the site
# uses only strictly necessary storage — the consent banner then stays hidden
# (no consent is required). Add e.g. "analytics" when you install analytics;
# the banner appears automatically and scripts wait for consent.
CONSENT_IN_USE = []

# Empty ("") = not provided yet: the field and its table row/section are hidden
# on the site, and the build lists it at the end so it can be filled in later.
COMPANY = {
    "brand": "DeliveryNextGen",
    "name": "",
    "form": "",
    "address": "",
    "country": {"en": "Spain", "pl": "Hiszpania"},
    "tax_id": "",
    "vat_id": "",
    "registry": "",
    "capital": "",
    "email": "danielmedinabello5@gmail.com",
    "privacy_email": "danielmedinabello5@gmail.com",
    "phone": "+34 683 405 430",
    "phone_href": "+34683405430",
    # TODO: update when hosting moves away from GitHub Pages (also revisit DOCS_UPDATED)
    "hosting": "GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA",
    "mail_provider": "Google Ireland Ltd (Gmail / Google Workspace)",
    "law": {"en": "Spanish law", "pl": "prawo hiszpańskie"},
    "court": {"en": "the Spanish courts competent for the registered office of the Service Provider", "pl": "sąd hiszpański właściwy dla siedziby Usługodawcy"},
    "permits": "",
}

LANGS = ("en", "pl")

# key: (en_slug, pl_slug, nav_label_en, nav_label_pl, in_main_nav)
PAGES = {
    "home":          ("index.html",            "index.html",                 "Home",          "Start",          False),
    "how":           ("how-it-works.html",     "jak-to-dziala.html",         "How it works",  "Jak to działa",  True),
    "solutions":     ("solutions.html",        "rozwiazania.html",           "Solutions",     "Rozwiązania",    True),
    "pricing":       ("pricing.html",          "cennik.html",                "Pricing",       "Cennik",         True),
    "about":         ("about.html",            "o-nas.html",                 "About",         "O nas",          True),
    "faq":           ("faq.html",              "faq.html",                   "FAQ",           "FAQ",            True),
    "coverage":      ("coverage.html",         "zasieg.html",                "Coverage",      "Zasięg",         False),
    "blog":          ("blog.html",             "blog.html",                  "Blog",          "Blog",           False),
    "developers":    ("developers.html",       "deweloperzy.html",           "Developers",    "Deweloperzy",    False),
    "contact":       ("contact.html",          "kontakt.html",               "Contact",       "Kontakt",        False),
    "legal":         ("legal-notice.html",     "nota-prawna.html",           "Legal notice",  "Nota prawna",    False),
    "privacy":       ("privacy-policy.html",   "polityka-prywatnosci.html",  "Privacy policy", "Polityka prywatności", False),
    "cookies":       ("cookie-policy.html",    "polityka-cookies.html",      "Cookie policy", "Polityka cookies", False),
    "terms":         ("terms.html",            "regulamin.html",             "Terms of service", "Regulamin",   False),
    "accessibility": ("accessibility.html",    "dostepnosc.html",            "Accessibility", "Dostępność",     False),
}

STR = {
    "en": {
        "skip": "Skip to content",
        "menu": "Open menu",
        "cta": "Book a demo",
        "home_label": "DeliveryNextGen — home",
        "switch_label": "Polski — zmień język na polski",
        "switch_text": "PL",
        "switch_lang": "pl",
        "lang_name": "Polski",
        "main_nav": "Main",
        "mobile_nav": "Mobile",
        "footer_desc": "Autonomous last-mile delivery robots for restaurants, retailers and logistics teams. Services for business customers only.",
        "f_product": "Product",
        "f_company": "Company",
        "f_legal": "Legal",
        "f_cookie_settings": "Cookie settings",
        "f_rights": "All rights reserved.",
        "f_b2b": "Offer for business customers. Prices exclude VAT.",
        "f_top": "Back to top",
        "f_demo": "Live demo",
        "app_path": "app/",
        "c_title": "Your privacy choices",
        "c_text": "We use only the storage that is strictly necessary for this website to work. Optional categories stay off unless you switch them on.",
        "c_accept": "Accept all",
        "c_reject": "Reject all",
        "c_settings": "Settings",
        "c_save": "Save choices",
        "c_close": "Close",
        "c_more": "Cookie policy",
        "c_dialog_text": "Choose which optional categories you allow. You can change your decision at any time from the footer link “Cookie settings”.",
        "c_nec": "Strictly necessary",
        "c_nec_text": "Security of the contact form (session cookie set only when you use the form) and remembering your privacy choices. Cannot be switched off.",
        "c_always": "Always on",
        "c_an": "Analytics",
        "c_an_text": "Anonymous statistics that help us improve the website.",
        "c_mk": "Marketing",
        "c_mk_text": "Measuring the effectiveness of our campaigns.",
        "c_unused": "Not used on this website",
        "og_locale": "en_GB",
        "legal_updated": "Last updated",
        "legal_print": "Print / save as PDF",
        "legal_toc": "On this page",
        "map_title": "Map of the delivery route from the restaurant to the customer through a narrow old-town alley",
        "map_alley": "ALLEY · 2.1 M",
        "map_van": "Van can't enter",
        "map_obstacle": "Obstacle",
        "map_restaurant": "Restaurant",
        "map_customer": "Customer",
    },
    "pl": {
        "skip": "Przejdź do treści",
        "menu": "Otwórz menu",
        "cta": "Umów demo",
        "home_label": "DeliveryNextGen — strona główna",
        "switch_label": "English — switch language to English",
        "switch_text": "EN",
        "switch_lang": "en",
        "lang_name": "English",
        "main_nav": "Główna",
        "mobile_nav": "Mobilna",
        "footer_desc": "Autonomiczne roboty dostawcze ostatniej mili dla restauracji, handlu i firm logistycznych. Usługi wyłącznie dla przedsiębiorców.",
        "f_product": "Produkt",
        "f_company": "Firma",
        "f_legal": "Informacje prawne",
        "f_cookie_settings": "Ustawienia cookies",
        "f_rights": "Wszelkie prawa zastrzeżone.",
        "f_b2b": "Oferta dla przedsiębiorców. Ceny netto (bez VAT).",
        "f_top": "Wróć na górę",
        "f_demo": "Demo na żywo",
        "app_path": "pl/app/",
        "c_title": "Twoje ustawienia prywatności",
        "c_text": "Używamy wyłącznie technologii niezbędnych do działania strony. Kategorie opcjonalne są wyłączone, dopóki ich nie włączysz.",
        "c_accept": "Akceptuj wszystkie",
        "c_reject": "Odrzuć wszystkie",
        "c_settings": "Ustawienia",
        "c_save": "Zapisz wybór",
        "c_close": "Zamknij",
        "c_more": "Polityka cookies",
        "c_dialog_text": "Wybierz, na które kategorie opcjonalne się zgadzasz. Decyzję możesz zmienić w każdej chwili przez link „Ustawienia cookies” w stopce.",
        "c_nec": "Niezbędne",
        "c_nec_text": "Bezpieczeństwo formularza kontaktowego (cookie sesyjne ustawiane dopiero, gdy korzystasz z formularza) oraz zapamiętanie Twoich wyborów prywatności. Nie można ich wyłączyć.",
        "c_always": "Zawsze aktywne",
        "c_an": "Analityczne",
        "c_an_text": "Anonimowe statystyki pomagające nam ulepszać stronę.",
        "c_mk": "Marketingowe",
        "c_mk_text": "Pomiar skuteczności naszych kampanii.",
        "c_unused": "Nieużywane na tej stronie",
        "og_locale": "pl_PL",
        "legal_updated": "Ostatnia aktualizacja",
        "legal_print": "Drukuj / zapisz jako PDF",
        "legal_toc": "Na tej stronie",
        "map_title": "Mapa trasy dostawy z restauracji do klienta przez wąską uliczkę starego miasta",
        "map_alley": "ZAUŁEK · 2,1 M",
        "map_van": "Bus nie wjedzie",
        "map_obstacle": "Przeszkoda",
        "map_restaurant": "Restauracja",
        "map_customer": "Klient",
    },
}

# --------------------------------------------------------------------------
# Icons (24×24, 1.6 stroke, currentColor)
# --------------------------------------------------------------------------
ICONS = {
    "map": '<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z"/><path d="M9 4v13.5M15 6.5V20"/>',
    "signal": '<path d="M12 20v-6"/><circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
    "lock": '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path class="shackle" d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2"/>',
    "plug": '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/>',
    "leaf": '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    "pin": '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    "store": '<path d="M4 9h16l-1.5-5h-13L4 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>',
    "cart": '<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2.5l2.2 11h10.6L20.5 7H7"/>',
    "truck": '<path d="M2 6h11v10H2zM13 10h4.5L21 13.5V16h-8"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    "campus": '<path d="M3 10 12 4l9 6M5 10v9h14v-9M10 19v-5h4v5"/>',
    "shield": '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "headset": '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/><path d="M19 20a3 3 0 0 1-3 2h-3"/>',
    "thermo": '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/>',
    "route": '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
    "check": '<path d="m5 12 5 5 9-10"/>',
    "x": '<path d="m6 6 12 12M18 6 6 18"/>',
    "up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    "print": '<path d="M7 9V3h10v6M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    "package": '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    "brain": '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h0a3 3 0 0 1-3-3"/>',
    "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
}


def icon(name, cls=""):
    c = f' class="{cls}"' if cls else ""
    return (f'<svg{c} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{ICONS[name]}</svg>')


def logo_svg(uid, cls="logo-mark"):
    """Monochrome mark: rounded square with two 'sensor eyes' cut out (uses currentColor)."""
    return (f'<svg class="{cls}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">'
            f'<defs><mask id="lm-{uid}"><rect width="32" height="32" rx="9" fill="#fff"/>'
            f'<rect x="8" y="13" width="5.5" height="7" rx="2.75" fill="#000"/>'
            f'<rect x="18.5" y="13" width="5.5" height="7" rx="2.75" fill="#000"/></mask></defs>'
            f'<rect width="32" height="32" rx="9" fill="currentColor" mask="url(#lm-{uid})"/></svg>')


# Cities shown on the coverage page (/coverage.html, /pl/zasieg.html).
# The site says we serve all major cities in Spain; the exact area is confirmed
# during the demo. TODO: keep this list in sync with real operations.
# (key, EN name, PL name, latitude, longitude, extra search aliases)
COVERAGE = [
    ("madrid",     "Madrid",     "Madryt",    40.42, -3.70, ["madryt"]),
    ("barcelona",  "Barcelona",  "Barcelona", 41.39,  2.17, ["barcelone"]),
    ("valencia",   "Valencia",   "Walencja",  39.47, -0.38, ["walencja", "valència"]),
    ("seville",    "Seville",    "Sewilla",   37.39, -5.98, ["sevilla", "sewilla"]),
    ("zaragoza",   "Zaragoza",   "Saragossa", 41.65, -0.88, ["saragossa", "saragosa"]),
    ("malaga",     "Málaga",     "Malaga",    36.72, -4.42, []),
    ("bilbao",     "Bilbao",     "Bilbao",    43.26, -2.93, ["bilbo"]),
    ("alicante",   "Alicante",   "Alicante",  38.35, -0.48, ["alacant"]),
    ("murcia",     "Murcia",     "Murcja",    37.98, -1.13, ["murcja"]),
    ("palma",      "Palma",      "Palma",     39.57,  2.65, ["palma de mallorca", "mallorca", "majorka"]),
    ("valladolid", "Valladolid", "Valladolid", 41.65, -4.72, []),
    ("granada",    "Granada",    "Grenada",   37.18, -3.60, ["grenada"]),
]

# Rough outline of mainland Spain and the Balearics as (lon, lat) — stylised map.
SPAIN = [(-8.4, 43.4), (-7.7, 43.75), (-7.0, 43.55), (-5.85, 43.65), (-4.5, 43.4), (-3.8, 43.47),
         (-3.0, 43.35), (-1.8, 43.38), (-1.4, 43.05), (-0.7, 42.85), (0.0, 42.7), (0.7, 42.85),
         (1.45, 42.6), (2.1, 42.45), (3.17, 42.43), (3.2, 41.9), (2.2, 41.4), (1.0, 41.05),
         (0.6, 40.6), (-0.3, 39.45), (0.2, 38.75), (-0.5, 38.35), (-0.75, 37.6), (-1.6, 37.3),
         (-2.1, 36.73), (-3.4, 36.72), (-4.42, 36.72), (-5.35, 36.15), (-5.6, 36.0), (-6.3, 36.5),
         (-6.4, 36.8), (-7.4, 37.2), (-7.5, 37.55), (-7.0, 38.0), (-7.3, 38.5), (-7.0, 39.0),
         (-7.5, 39.6), (-6.9, 40.25), (-6.85, 41.0), (-6.2, 41.6), (-6.6, 41.95), (-7.2, 41.9),
         (-8.1, 41.85), (-8.9, 41.9), (-8.9, 42.2), (-9.0, 42.6), (-9.3, 42.9), (-9.2, 43.2)]
ISLANDS = [(2.95, 39.6, 0.55, 0.32), (4.1, 39.97, 0.28, 0.12), (1.4, 38.98, 0.22, 0.16)]


# Label placement on the map (dx, dy, text-anchor) where the default (right) would collide.
LABEL_POS = {"barcelona": (0, -18, "middle"), "palma": (0, -18, "middle"), "murcia": (-14, 5, "end")}


def geo(lon, lat):
    return round((lon + 9.8) * 60, 1), round((44.2 - lat) * 60 * 1.31, 1)


def coverage_svg(lang):
    pts = " ".join(f"{x},{y}" for x, y in (geo(lo, la) for lo, la in SPAIN))
    isl = "".join(f'<ellipse cx="{geo(lo, la)[0]}" cy="{geo(lo, la)[1]}" rx="{rx * 60:.0f}" ry="{ry * 60 * 1.31:.0f}"/>'
                  for lo, la, rx, ry in ISLANDS)
    dots = []
    for i, (key, en, pl, la, lo, _) in enumerate(COVERAGE):
        x, y = geo(lo, la)
        name = html.escape(en if lang == "en" else pl)
        dx, dy, anchor = LABEL_POS.get(key, (14, 5, "start"))
        dots.append(f'<g class="cv-city" data-city="{key}" transform="translate({x} {y})">'
                    f'<circle class="cv-wave" r="10"/><circle class="cv-dot" r="7"/>'
                    f'<text x="{dx}" y="{dy}" text-anchor="{anchor}">{name}</text></g>')
    return (f'<svg class="cv-map" viewBox="0 0 900 690" role="img" aria-labelledby="cv-map-title">'
            f'<title id="cv-map-title">{"Map of Spain with the cities we serve" if lang == "en" else "Mapa Hiszpanii z obsługiwanymi miastami"}</title>'
            f'<polygon class="cv-land" points="{pts}"/><g class="cv-land">{isl}</g>'
            f'<g class="cv-cities">{"".join(dots)}</g></svg>')


def coverage_data(lang):
    data = [{"k": k, "n": (en if lang == "en" else pl),
             "a": sorted({en.lower(), pl.lower(), *[a.lower() for a in al]})}
            for k, en, pl, _, _, al in COVERAGE]
    return html.escape(json.dumps(data, ensure_ascii=False), quote=True)


def coverage_list(lang):
    return "".join(f'<li><button type="button" class="cv-chip" data-pick="{k}">{html.escape(en if lang == "en" else pl)}</button></li>'
                   for k, en, pl, *_ in COVERAGE)


# --------------------------------------------------------------------------
# Blog: src/posts/<lang>/<slug>.html with front matter. Published at
# /blog-<slug>.html (EN) and /pl/blog-<slug>.html (PL). "pair" = slug of the
# same post in the other language; "kind" = article | scenario.
# --------------------------------------------------------------------------
BLOG_STR = {
    "en": {"article": "Article", "scenario": "Example scenario", "articles": "Articles",
           "scenarios": "Implementation scenarios", "read": "min read", "back": "All posts",
           "more": "Keep reading", "open": "Read",
           "disclaimer": "<strong>Example scenario.</strong> This page describes a typical implementation based on our published prices and process. It is not a description of a real customer, and the figures are illustrative.",
           "scen_intro": "How a rollout typically looks for different kinds of businesses. Illustrative examples based on our published plans — not customer stories.",
           "art_intro": "Notes on last-mile delivery, pilots and working with robots on the pavement."},
    "pl": {"article": "Artykuł", "scenario": "Przykładowy scenariusz", "articles": "Artykuły",
           "scenarios": "Scenariusze wdrożeń", "read": "min czytania", "back": "Wszystkie wpisy",
           "more": "Czytaj dalej", "open": "Czytaj",
           "disclaimer": "<strong>Przykładowy scenariusz.</strong> Ta strona opisuje typowe wdrożenie na podstawie naszego cennika i procesu. Nie jest to opis rzeczywistego klienta, a liczby mają charakter poglądowy.",
           "scen_intro": "Jak zwykle wygląda wdrożenie w różnych rodzajach firm. Poglądowe przykłady oparte na naszych planach — nie historie klientów.",
           "art_intro": "O dostawach ostatniej mili, pilotażach i pracy z robotami na chodniku."},
}
MONTHS = {"en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
          "pl": ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"]}


def fmt_date(iso, lang):
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{d} {MONTHS[lang][m - 1]} {y}"


def load_posts(lang):
    posts = []
    folder = SRC / "posts" / lang
    for f in sorted(folder.glob("*.html")) if folder.exists() else []:
        meta, body = parse_page(f)
        meta["slug"] = f.stem
        meta["file"] = "blog-" + f.stem + ".html"
        meta["body"] = body
        posts.append(meta)
    posts.sort(key=lambda m: m["date"], reverse=True)
    return posts


def post_card(m, lang, root=""):
    B = BLOG_STR[lang]
    art = m.get("art", "")
    art_html = f'<div class="post-art">{{{{shared:{art}}}}}</div>' if art else '<div class="post-art post-art--plain">{{icon:' + m.get("icon", "spark") + '}}</div>'
    return (f'<article class="post-card" data-kind="{m["kind"]}">{art_html}'
            f'<div class="post-body"><p class="post-kind post-kind--{m["kind"]}">{B[m["kind"]]}</p>'
            f'<h3><a href="{root}{m["file"]}">{html.escape(m["title"])}</a></h3>'
            f'<p>{html.escape(m["excerpt"])}</p>'
            f'<p class="post-meta"><time datetime="{m["date"]}">{fmt_date(m["date"], lang)}</time> · {m["read"]} {B["read"]}</p></div></article>')


def blog_list(lang):
    B = BLOG_STR[lang]
    posts = load_posts(lang)
    out = []
    for kind, title, intro in (("article", B["articles"], B["art_intro"]), ("scenario", B["scenarios"], B["scen_intro"])):
        items = [post_card(m, lang) for m in posts if m["kind"] == kind]
        if not items:
            continue
        out.append(f'<section class="blog-group" aria-labelledby="bg-{kind}"><div class="blog-group-head">'
                   f'<h2 class="headline-s" id="bg-{kind}">{title}</h2><p>{intro}</p></div>'
                   f'<div class="post-grid" data-stagger>{"".join(items)}</div></section>')
    return "\n".join(out)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def slug(key, lang):
    return PAGES[key][0 if lang == "en" else 1]


def href(key, lang):
    """Relative link from a page in `lang` to page `key` in the same language."""
    s = slug(key, lang)
    return "./" if s == "index.html" else s


def alt_href(key, lang):
    other = "pl" if lang == "en" else "en"
    s = slug(key, other)
    return ("pl/" if other == "pl" else "../") + ("" if s == "index.html" else s)


def abs_url(key, lang):
    s = slug(key, lang)
    path = ("/pl/" if lang == "pl" else "/") + ("" if s == "index.html" else s)
    return SITE_URL + path


TODO_FOUND = set()


def load_strings(lang, page):
    """Read src/i18n/<lang>/common.txt + <page>.txt. Blocks start with '@@ key' lines."""
    out = {}
    for name in ("common", page):
        p = SRC / "i18n" / lang / f"{name}.txt"
        if not p.exists():
            continue
        key, buf = None, []
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("@@ "):
                if key:
                    out[key] = "\n".join(buf).strip()
                key, buf = line[3:].strip(), []
            elif key:
                buf.append(line)
        if key:
            out[key] = "\n".join(buf).strip()
    return out


def company_get(k, lang="en"):
    v = COMPANY[k]
    if isinstance(v, dict):          # per-language value: {"en": ..., "pl": ...}
        v = v.get(lang, v["en"])
    return v


def company_value(k, lang="en"):
    # Derived values join only the parts that are filled in.
    joins = {"place": ["address", "country"],
             "idplace": ["address", "country", "tax_id"],
             "idfull": ["address", "country", "registry", "tax_id"]}
    if k == "who":
        return html.escape(company_get("name", lang) or COMPANY["brand"])
    if k in joins:
        return html.escape(", ".join(x for x in (company_get(j, lang) for j in joins[k]) if x))
    v = company_get(k, lang)
    if not v:
        return ""
    if v.startswith("["):
        TODO_FOUND.add(f"COMPANY['{k}']")
        return f'<mark class="todo">{html.escape(v)}</mark>'
    return html.escape(v)


def company_blocks(text, lang):
    """[[if key]]..[[/if]] keeps a block only when COMPANY[key] is filled in;
    [[ifnot key]]..[[/ifnot]] keeps it only when it is empty."""
    def rep(m):
        filled = bool(company_get(m.group(2), lang))
        return m.group(3) if filled == (m.group(1) == "if") else ""
    # innermost blocks first, so blocks may be nested
    pat = r"\[\[(if|ifnot) (\w+)\]\]((?:(?!\[\[(?:if|ifnot) ).)*?)\[\[/\1\]\]"
    prev = None
    while prev != text:
        prev = text
        text = re.sub(pat, rep, text, flags=re.S)
    return text


def render_tokens(text, lang, root, ctx):
    def rep(m):
        tok = m.group(1).strip()
        if tok == "root":
            return root
        if tok == "lang":
            return lang
        if tok == "year":
            return str(date.today().year)
        if tok == "updated":
            return DOCS_UPDATED
        if tok.startswith("url:"):
            k = tok[4:]
            if k == "home" and ctx.get("is404"):
                return root + ("pl/" if lang == "pl" else "")
            if ctx.get("is404"):
                return root + ("pl/" if lang == "pl" else "") + ("" if slug(k, lang) == "index.html" else slug(k, lang))
            return href(k, lang)
        if tok.startswith("t:"):
            k = tok[2:]
            if k not in ctx.get("strings", {}):
                raise KeyError(f"Missing string '{k}' for {lang}/{ctx.get('page')}")
            return ctx["strings"][k]
        if tok.startswith("c."):
            return company_value(tok[2:], lang)
        if tok.startswith("raw."):
            return html.escape(COMPANY[tok[4:]])
        if tok.startswith("icon:"):
            parts = tok[5:].split("|")
            return icon(parts[0], parts[1] if len(parts) > 1 else "")
        if tok.startswith("logo:"):
            return logo_svg(tok[5:])
        if tok.startswith("shared:"):
            p = SRC / "partials" / "shared" / (tok[7:] + ".html")
            return render_tokens(p.read_text(encoding="utf-8"), lang, root, ctx)
        if tok.startswith("partial:"):
            p = SRC / "partials" / lang / (tok[8:] + ".html")
            return render_tokens(p.read_text(encoding="utf-8"), lang, root, ctx)
        if tok.startswith("s."):
            return STR[lang][tok[2:]]
        if tok.startswith("nav."):
            return PAGES[tok[4:]][2 if lang == "en" else 3]
        if tok.startswith("unused:"):
            if tok[7:] in CONSENT_IN_USE:
                return ""
            return f' <span class="unused">— {STR[lang]["c_unused"]}</span>'
        if tok == "consent_in_use":
            return ",".join(CONSENT_IN_USE)
        if tok in ctx:
            return ctx[tok]
        raise KeyError(f"Unknown token {{{{{tok}}}}}")
    # partials may contain tokens, so loop until stable
    prev = None
    while prev != text:
        prev = text
        text = company_blocks(text, lang)
        text = re.sub(r"\{\{\s*([^{}]+?)\s*\}\}", rep, text)
    return text


def parse_page(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
    if not m:
        raise ValueError(f"{path}: missing front matter")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, m.group(2)


def nav_html(lang, current, root, is404=False):
    def h(k):
        if is404:
            return root + ("pl/" if lang == "pl" else "") + ("" if slug(k, lang) == "index.html" else slug(k, lang))
        return href(k, lang)
    main_links = []
    mobile_links = []
    n = 0
    for key, row in PAGES.items():
        label = row[2 if lang == "en" else 3]
        if row[4]:
            cur = ' aria-current="page"' if key == current else ""
            main_links.append(f'<a href="{h(key)}"{cur}>{label}</a>')
        if key in ("home", "how", "solutions", "pricing", "about", "faq", "contact"):
            n += 1
            cur = ' aria-current="page"' if key == current else ""
            mobile_links.append(f'<a href="{h(key)}"{cur}>{label}</a>')
    return "\n        ".join(main_links), "\n      ".join(mobile_links)


def json_ld(lang):
    data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": COMPANY["brand"],
        "url": SITE_URL + ("/pl/" if lang == "pl" else "/"),
        "logo": SITE_URL + "/assets/img/logo.png",
        "email": COMPANY["email"],
        "telephone": COMPANY["phone"],
    }
    if COMPANY["name"] and not COMPANY["name"].startswith("["):
        data["legalName"] = COMPANY["name"]
    return json.dumps(data, ensure_ascii=False)


PAGE_JS = {"contact": ["booking.js"], "coverage": ["coverage.js"], "developers": ["developers.js"]}


def post_body(m, lang):
    """Article page around a post body (tokens are rendered later with the page)."""
    B = BLOG_STR[lang]
    others = [o for o in load_posts(lang) if o["slug"] != m["slug"]][:3]
    note = f'<p class="note scenario-note">{B["disclaimer"]}</p>' if m["kind"] == "scenario" else ""
    home = "Home" if lang == "en" else "Start"
    return f"""
    <section class="page-hero post-hero" aria-labelledby="page-title">
      <div class="container container--narrow">
        <ol class="breadcrumbs" aria-label="{'Breadcrumb' if lang == 'en' else 'Ścieżka nawigacji'}" data-reveal><li><a href="{{{{url:home}}}}">{home}</a></li><li><a href="{{{{url:blog}}}}">Blog</a></li><li aria-current="page">{html.escape(m["title"])}</li></ol>
        <p class="post-kind post-kind--{m["kind"]}" data-reveal>{B[m["kind"]]}</p>
        <h1 class="display" id="page-title" data-split>{html.escape(m["title"])}</h1>
        <p class="lead" data-reveal data-delay="0.2">{html.escape(m["excerpt"])}</p>
        <p class="post-meta" data-reveal data-delay="0.3"><time datetime="{m["date"]}">{fmt_date(m["date"], lang)}</time> · {m["read"]} {B["read"]}</p>
      </div>
    </section>
    <section class="section section--surface post-section">
      <div class="container container--narrow">
        <div class="prose post-prose">{note}{m["body"]}</div>
        <p class="post-back"><a class="more" href="{{{{url:blog}}}}">{B["back"]}</a></p>
      </div>
    </section>
    <section class="section" aria-labelledby="more-title">
      <div class="container">
        <h2 class="headline-s" id="more-title">{B["more"]}</h2>
        <div class="post-grid post-grid--more">{"".join(post_card(o, lang) for o in others)}</div>
      </div>
    </section>
{{{{partial:cta}}}}
"""


def post_json_ld(m, lang, url):
    return json.dumps({
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": m["title"], "description": m["description"], "datePublished": m["date"],
        "inLanguage": lang, "url": url, "mainEntityOfPage": url,
        "image": SITE_URL + "/assets/img/og-image.png",
        "author": {"@type": "Organization", "name": COMPANY["brand"]},
        "publisher": {"@type": "Organization", "name": COMPANY["brand"], "logo": {"@type": "ImageObject", "url": SITE_URL + "/assets/img/logo.png"}},
    }, ensure_ascii=False)


def build_page(lang, key, src_path, is404=False, post=None):
    strings = load_strings(lang, key)
    if post:
        meta, body = post, post_body(post, lang)
    elif src_path.parent.name == "shared":
        raw = src_path.read_text(encoding="utf-8")
        meta, body = {}, raw
        if raw.startswith("---\n"):
            meta, body = parse_page(src_path)
        meta.setdefault("title", strings["meta.title"])
        meta.setdefault("description", strings["meta.description"])
        meta.setdefault("bodyclass", strings.get("meta.bodyclass", ""))
    else:
        meta, body = parse_page(src_path)
    S = STR[lang]
    if is404:
        root = "/"
    else:
        root = "../" if lang == "pl" else ""
    ctx = {"is404": is404, "strings": strings, "page": key}
    main_links, mobile_links = nav_html(lang, key, root, is404)
    layout = (SRC / "layout.html").read_text(encoding="utf-8")

    if is404:
        canonical = SITE_URL + "/404.html"
        alternates = ""
        switch_href = "/pl/" if lang == "en" else "/"
        home = "/" if lang == "en" else "/pl/"
    elif post:
        other = "pl" if lang == "en" else "en"
        own = SITE_URL + ("/pl/" if lang == "pl" else "/") + post["file"]
        pair = post.get("pair", "")
        pair_url = SITE_URL + ("/pl/" if other == "pl" else "/") + "blog-" + pair + ".html" if pair else ""
        canonical = own
        en_url, pl_url = (own, pair_url) if lang == "en" else (pair_url, own)
        alternates = (f'<link rel="alternate" hreflang="en" href="{en_url}">\n  '
                      f'<link rel="alternate" hreflang="pl" href="{pl_url}">\n  '
                      f'<link rel="alternate" hreflang="x-default" href="{en_url}">') if pair else ""
        switch_href = (("pl/" if other == "pl" else "../") + "blog-" + pair + ".html") if pair else alt_href("blog", lang)
        home = href("home", lang)
    else:
        canonical = abs_url(key, lang)
        alternates = (f'<link rel="alternate" hreflang="en" href="{abs_url(key, "en")}">\n  '
                      f'<link rel="alternate" hreflang="pl" href="{abs_url(key, "pl")}">\n  '
                      f'<link rel="alternate" hreflang="x-default" href="{abs_url(key, "en")}">')
        switch_href = alt_href(key, lang)
        home = href("home", lang)

    ctx.update({
        "title": html.escape(meta["title"]),
        "description": html.escape(meta["description"]),
        "canonical": canonical,
        "alternates": alternates,
        "bodyclass": meta.get("bodyclass", ""),
        "robots": meta.get("robots", "index, follow"),
        "main_links": main_links,
        "mobile_links": mobile_links,
        "switch_href": switch_href,
        "home_href": home,
        "contact_href": (root + ("pl/" if lang == "pl" else "") + slug("contact", lang)) if is404 else href("contact", lang),
        "ver": ASSET_VERSION,
        "jsonld": post_json_ld(post, lang, canonical) if post else json_ld(lang),
        "page_js": "".join(f'<script src="{root}assets/js/{js}?v={ASSET_VERSION}" defer></script>'
                           for js in PAGE_JS.get(key, [])),
        "coverage_map": coverage_svg(lang),
        "coverage_data": coverage_data(lang),
        "coverage_list": coverage_list(lang),
        "blog_list": blog_list(lang) if key == "blog" else "",
        "og_image": SITE_URL + "/assets/img/og-image.png",
        "footnotes": "",
    })
    # Support chat demo (chat.js): page links it can offer, resolved per language / depth
    chat_links = {k: render_tokens("{{url:%s}}" % k, lang, root, ctx)
                  for k in ("pricing", "how", "solutions", "contact", "legal", "terms", "privacy", "cookies", "coverage", "blog", "developers")}
    chat_links["booking"] = chat_links["contact"] + "#booking"
    chat_links["app"] = root + S["app_path"]
    chat_links["app_integrations"] = root + S["app_path"] + "#integrations"
    ctx["chat_links"] = html.escape(json.dumps(chat_links, ensure_ascii=False), quote=True)
    if strings.get("footnotes"):
        ctx["footnotes"] = (f'<div class="footnotes"><ol>'
                            f'{render_tokens(strings["footnotes"], lang, root, ctx)}</ol></div>')
    ctx["content"] = render_tokens(body, lang, root, ctx)
    out = render_tokens(layout, lang, root, ctx)
    return out


def load_file_strings(lang, name):
    """Strings from one i18n file only (no common.txt)."""
    out, key, buf = {}, None, []
    for line in (SRC / "i18n" / lang / f"{name}.txt").read_text(encoding="utf-8").splitlines():
        if line.startswith("@@ "):
            if key:
                out[key] = "\n".join(buf).strip()
            key, buf = line[3:].strip(), []
        elif key:
            buf.append(line)
    if key:
        out[key] = "\n".join(buf).strip()
    return out


def build_app(lang):
    """Live demo dashboard: /app/ (EN) and /pl/app/ (PL). Single page, hash routing,
    all UI strings also shipped to app.js as a JSON data block."""
    strings = load_file_strings(lang, "app")
    root = "../../" if lang == "pl" else "../"
    other = "pl" if lang == "en" else "en"
    blob = json.dumps(strings, ensure_ascii=False).replace("</", "<\\/")
    ctx = {
        "strings": strings, "page": "app",
        "title": html.escape(strings["meta.title"]),
        "description": html.escape(strings["meta.description"]),
        "ver": ASSET_VERSION,
        "app_json": blob,
        "site_href": "../",
        "switch_href": "../pl/app/" if lang == "en" else "../../app/",
        "switch_lang": other,
        "switch_code": other.upper(),
    }
    tpl = (SRC / "app" / "app.html").read_text(encoding="utf-8")
    out_dir = OUT / ("pl/app" if lang == "pl" else "app")
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "index.html"
    target.write_text(render_tokens(tpl, lang, root, ctx), encoding="utf-8")
    return target


def build_present(lang):
    """Demo-day presentation: /present/ (EN) and /pl/present/ (PL). Reuses copy from
    home.txt and how.txt (the latter prefixed with "how.") plus present.txt."""
    strings = load_file_strings(lang, "home")
    strings.update({"how." + k: v for k, v in load_file_strings(lang, "how").items()})
    strings.update(load_file_strings(lang, "present"))
    root = "../../" if lang == "pl" else "../"
    other = "pl" if lang == "en" else "en"
    blob = json.dumps(strings, ensure_ascii=False).replace("</", "<\\/")
    ctx = {
        "strings": strings, "page": "present",
        "title": html.escape(strings["meta.title"]),
        "description": html.escape(strings["meta.description"]),
        "ver": ASSET_VERSION,
        "present_json": blob,
        "site_href": root + ("pl/" if lang == "pl" else ""),
        "app_href": root + STR[lang]["app_path"],
        "site_host": SITE_URL.split("//", 1)[-1],
        "switch_href": "../pl/present/" if lang == "en" else "../../present/",
        "switch_lang": other,
        "switch_code": other.upper(),
    }
    tpl = (SRC / "present" / "present.html").read_text(encoding="utf-8")
    out_dir = OUT / ("pl/present" if lang == "pl" else "present")
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "index.html"
    target.write_text(render_tokens(tpl, lang, root, ctx), encoding="utf-8")
    return target


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    written = []
    for lang in LANGS:
        for key in PAGES:
            src = SRC / "pages" / "shared" / f"{key}.html"
            if not src.exists():
                src = SRC / "pages" / lang / f"{key}.html"
            if not src.exists():
                print(f"  ! missing {src.relative_to(BASE)}")
                continue
            out_dir = OUT / ("pl" if lang == "pl" else "")
            out_dir.mkdir(parents=True, exist_ok=True)
            target = out_dir / slug(key, lang)
            target.write_text(build_page(lang, key, src), encoding="utf-8")
            written.append(target)
    for lang in LANGS:
        out_dir = OUT / ("pl" if lang == "pl" else "")
        for m in load_posts(lang):
            target = out_dir / m["file"]
            target.write_text(build_page(lang, "blog", None, post=m), encoding="utf-8")
            written.append(target)
    for lang in LANGS:
        written.append(build_app(lang))
        written.append(build_present(lang))
    # bilingual 404 (served by Apache at any path, so root-absolute assets)
    src404 = SRC / "pages" / "en" / "404.html"
    if src404.exists():
        (OUT / "404.html").write_text(build_page("en", "404", src404, is404=True), encoding="utf-8")
        written.append(OUT / "404.html")

    # sitemap
    urls = []
    for key in PAGES:
        for lang in LANGS:
            alts = "".join(
                f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{abs_url(key, l)}"/>' for l in LANGS)
            urls.append(f"  <url>\n    <loc>{abs_url(key, lang)}</loc>{alts}\n    <lastmod>{date.today().isoformat()}</lastmod>\n  </url>")
    for lang in LANGS:
        for m in load_posts(lang):
            loc = SITE_URL + ("/pl/" if lang == "pl" else "/") + m["file"]
            urls.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{m['date']}</lastmod>\n  </url>")
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")

    # robots.txt + security.txt (RFC 9116)
    (OUT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /send_lead.php\nDisallow: /csrf.php\nDisallow: /includes/\n\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    expires = date(date.today().year + 1, date.today().month, min(date.today().day, 28)).isoformat()
    (OUT / ".well-known").mkdir(exist_ok=True)
    (OUT / ".well-known" / "security.txt").write_text(
        f"Contact: mailto:{COMPANY['email']}\n"
        f"Expires: {expires}T00:00:00.000Z\n"
        "Preferred-Languages: en, pl, es\n"
        f"Canonical: {SITE_URL}/.well-known/security.txt\n", encoding="utf-8")

    print(f"Built {len(written)} pages + sitemap.xml, robots.txt, security.txt into {OUT.relative_to(BASE)}/")
    missing = sorted(k for k, v in COMPANY.items() if not company_get(k))
    if missing or TODO_FOUND:
        print("\nStill to fill in (hidden on the site until provided):")
        for k in missing:
            print(f"  - COMPANY['{k}']")
        for t in sorted(TODO_FOUND):
            print("  -", t, "(highlighted on the site)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
