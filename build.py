#!/usr/bin/env python3
"""
DeliveryNextGen V2 — static site builder (Python 3.8+, no dependencies).

    python build.py

Reads   src/layout.html, src/partials/<lang>/*.html, src/pages/<lang>/*.html
Writes  public_html/*.html (EN) and public_html/pl/*.html (PL),
        public_html/sitemap.xml

Fill in COMPANY below before publishing. Every value that still starts with "["
is rendered as a highlighted <mark class="todo"> on the site and is listed at
the end of the build so nothing is missed.
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
ASSET_VERSION = "2.0.0"                              # bump to bust caches
DOCS_UPDATED = "18.10.2026"                          # date of the legal documents

# Non-essential cookie categories actually in use. Leave empty while the site
# uses only strictly necessary storage — the consent banner then stays hidden
# (no consent is required). Add e.g. "analytics" when you install analytics;
# the banner appears automatically and scripts wait for consent.
CONSENT_IN_USE = []

COMPANY = {
    "brand": "DeliveryNextGen",
    "name": "[Full legal name of the company]",
    "form": "[Legal form, e.g. sp. z o.o. / S.L. / sole trader]",
    "address": "[Registered address: street, number, postcode, city]",
    "country": {"en": "Spain", "pl": "Hiszpania"},
    "tax_id": "[Tax ID: NIP (PL) / NIF or CIF (ES)]",
    "vat_id": "[EU VAT number, e.g. PL0000000000 / ESX0000000X]",
    "registry": "[Register entry: KRS no. and court (PL) / Registro Mercantil, tomo, folio, hoja (ES) / CEIDG (PL sole trader)]",
    "capital": "[Share capital, if a company — otherwise remove]",
    "email": "danielmedinabello5@gmail.com",
    "privacy_email": "danielmedinabello5@gmail.com",
    "phone": "+34 683 405 430",
    "phone_href": "+34683405430",
    "hosting": "GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA",
    "mail_provider": "Google Ireland Ltd (Gmail / Google Workspace)",
    "law": {"en": "Spanish law", "pl": "prawo hiszpańskie"},
    "court": {"en": "the Spanish courts competent for the registered office of the Service Provider", "pl": "sąd hiszpański właściwy dla siedziby Usługodawcy"},
    "permits": "[Authorisations for operating delivery robots in public space, if required in a given city — or remove]",
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


def company_value(k, lang="en"):
    v = COMPANY[k]
    if isinstance(v, dict):          # per-language value: {"en": ..., "pl": ...}
        v = v.get(lang, v["en"])
    if v.startswith("["):
        TODO_FOUND.add(f"COMPANY['{k}']")
        return f'<mark class="todo">{html.escape(v)}</mark>'
    return html.escape(v)


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
    if not COMPANY["name"].startswith("["):
        data["legalName"] = COMPANY["name"]
    return json.dumps(data, ensure_ascii=False)


def build_page(lang, key, src_path, is404=False):
    strings = load_strings(lang, key)
    if src_path.parent.name == "shared":
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
        "jsonld": json_ld(lang),
        "og_image": SITE_URL + "/assets/img/og-image.png",
        "footnotes": "",
    })
    if strings.get("footnotes"):
        ctx["footnotes"] = (f'<div class="footnotes"><ol>'
                            f'{render_tokens(strings["footnotes"], lang, root, ctx)}</ol></div>')
    ctx["content"] = render_tokens(body, lang, root, ctx)
    out = render_tokens(layout, lang, root, ctx)
    return out


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
    if TODO_FOUND:
        print("\nStill to fill in before publishing (shown highlighted on the site):")
        for t in sorted(TODO_FOUND):
            print("  -", t, "=", COMPANY[t.split("'")[1]])
    return 0


if __name__ == "__main__":
    sys.exit(main())
