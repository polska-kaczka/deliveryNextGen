#!/usr/bin/env python3
"""
Generates src/partials/shared/hero-scene.html — the layered 2D city scene behind
the hero robot. Every layer is a seamless tile (left and right edges match), so
the script can scroll it endlessly. Colours come from CSS variables (--sc-*), so
the same scene works on light and dark bands.

    python tools/make_scene.py
"""
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "partials" / "shared" / "hero-scene.html"
W = 1600
rnd = random.Random(7)
rdet = random.Random(11)  # separate stream for details, so the skyline itself stays the same


def svg(h, body, cls):
    return (f'<svg class="scene-tile {cls}" viewBox="0 0 {W} {h}" preserveAspectRatio="xMinYMax meet" '
            f'aria-hidden="true" focusable="false">{body}</svg>')


def far():
    h, parts, x = 300, [], 0
    while x < W:
        w = rnd.choice([60, 80, 90, 110, 130, 150])
        w = min(w, W - x)
        top = rnd.randint(90, 230)
        parts.append(f'<rect x="{x}" y="{top}" width="{w + 1}" height="{h - top}"/>')
        if rnd.random() < 0.18 and w > 70:  # spire / antenna
            cx = x + w // 2
            parts.append(f'<rect x="{cx - 2}" y="{top - 36}" width="4" height="36"/>')
        if rnd.random() < 0.22 and w > 80:  # stepped crown
            parts.append(f'<rect x="{x + 14}" y="{top - 18}" width="{w - 28}" height="18"/>')
        x += w
    return svg(h, f'<g class="sc-far">{"".join(parts)}</g>', "tile-far")


def mid():
    h, blocks, wins, x = 240, [], [], 0
    while x < W:
        w = rnd.choice([110, 140, 160, 190])
        w = min(w, W - x)
        top = rnd.randint(40, 120)
        blocks.append(f'<rect x="{x}" y="{top}" width="{w + 1}" height="{h - top}"/>')
        # cornice
        blocks.append(f'<rect x="{x}" y="{top}" width="{w + 1}" height="6" class="sc-cornice"/>')
        cols = max(2, (w - 24) // 26)
        gap = (w - 24 - cols * 12) / max(1, cols - 1)
        for r in range(int((h - top - 40) // 34)):
            for c in range(cols):
                wx = x + 12 + c * (12 + gap)
                wy = top + 22 + r * 34
                lit = rnd.random() < 0.18
                cls = "sc-lit" if lit else ""
                if rdet.random() < 0.07:  # someone switches the light on / off
                    cls = f"sc-lit sc-blink b{rdet.randint(1, 4)}"
                wins.append(f'<rect x="{wx:.1f}" y="{wy}" width="12" height="18" rx="1.5"'
                            f'{f" class=\"{cls}\"" if cls else ""}/>')
        x += w + rnd.choice([0, 0, 14])
    return svg(h, f'<g class="sc-mid">{"".join(blocks)}</g><g class="sc-win">{"".join(wins)}</g>', "tile-mid")


def near():
    h = 300
    g = []
    # street lamps
    for lx in (120, 520, 920, 1320):
        g.append(f'<g class="sc-lamp"><rect x="{lx - 3}" y="70" width="6" height="230" rx="3"/>'
                 f'<path d="M{lx} 76 q0 -22 26 -22 h24" fill="none" stroke-width="5" stroke-linecap="round"/>'
                 f'<rect x="{lx + 40}" y="50" width="26" height="10" rx="5"/></g>'
                 f'<ellipse class="sc-glow" cx="{lx + 53}" cy="70" rx="40" ry="16"/>'
                 f'<path class="sc-cone" d="M{lx + 42} 60 L{lx - 10} 300 H{lx + 116} L{lx + 64} 60 Z"/>')
    # trees
    for tx, s in ((300, 1.0), (760, 0.85), (1120, 1.1), (1500, 0.9)):
        g.append(f'<g class="sc-tree" transform="translate({tx} 300) scale({s})">'
                 f'<rect x="-4" y="-120" width="8" height="120" rx="3" class="sc-trunk"/>'
                 f'<circle cx="0" cy="-150" r="52"/><circle cx="-38" cy="-120" r="36"/><circle cx="40" cy="-118" r="38"/>'
                 f'<circle cx="-6" cy="-112" r="40" class="sc-tree2"/></g>')
    # bench, bollards, bike rack
    g.append('<g class="sc-street"><rect x="610" y="262" width="90" height="8" rx="3"/><rect x="616" y="246" width="78" height="6" rx="3"/>'
             '<rect x="618" y="270" width="5" height="30"/><rect x="687" y="270" width="5" height="30"/>'
             '<rect x="980" y="258" width="10" height="42" rx="5"/><rect x="1020" y="258" width="10" height="42" rx="5"/><rect x="1060" y="258" width="10" height="42" rx="5"/>'
             '<path d="M1400 300 v-30 a18 18 0 0 1 36 0 v30 M1450 300 v-30 a18 18 0 0 1 36 0 v30" fill="none" stroke-width="5"/></g>')
    # hydrant, litter bin, bus shelter, mailbox, sign
    g.append('<g class="sc-street">'
             '<rect x="440" y="262" width="16" height="38" rx="6"/><rect x="434" y="270" width="28" height="7" rx="3.5"/><rect x="442" y="254" width="12" height="10" rx="5"/>'
             '<rect x="844" y="260" width="30" height="40" rx="4"/><rect x="840" y="254" width="38" height="8" rx="3"/>'
             '<rect x="1180" y="150" width="6" height="150"/><rect x="1300" y="150" width="6" height="150"/><rect x="1172" y="140" width="142" height="12" rx="4"/>'
             '<rect x="1196" y="250" width="92" height="7" rx="3"/><rect x="1200" y="257" width="5" height="43"/><rect x="1279" y="257" width="5" height="43"/>'
             '<rect x="200" y="236" width="34" height="44" rx="10"/><rect x="214" y="280" width="6" height="20"/>'
             '<rect x="1556" y="120" width="5" height="180"/><rect x="1536" y="104" width="44" height="28" rx="5"/></g>')
    g.append('<g class="sc-shelter"><rect x="1192" y="160" width="102" height="86" rx="3"/></g>')
    return svg(h, "".join(g), "tile-near")


def road():
    h = 60
    dashes = "".join(f'<rect x="{x}" y="34" width="64" height="5" rx="2.5"/>' for x in range(30, W, 160))
    holes = "".join(f'<ellipse cx="{x}" cy="50" rx="30" ry="4"/>' for x in (380, 1180))
    return svg(h, f'<rect class="sc-curb" x="0" y="0" width="{W}" height="3"/><rect class="sc-curb2" x="0" y="3" width="{W}" height="5"/>'
                  f'<g class="sc-dash">{dashes}</g><g class="sc-hole">{holes}</g>', "tile-road")


def sky():
    h, g = 160, []
    for cx, cy, sc in ((180, 70, 1.0), (620, 40, 0.7), (1010, 86, 1.2), (1390, 52, 0.85)):
        g.append(f'<g transform="translate({cx} {cy}) scale({sc})"><rect x="-70" y="0" width="140" height="26" rx="13"/>'
                 f'<circle cx="-22" cy="2" r="22"/><circle cx="16" cy="-6" r="28"/></g>')
    stars = "".join(f'<circle cx="{rdet.randint(0, W)}" cy="{rdet.randint(6, h - 20)}" r="{rdet.choice([1, 1.2, 1.6])}"'
                    f' class="tw{rdet.randint(1, 3)}"/>' for _ in range(34))
    return svg(h, f'<g class="sc-cloud">{"".join(g)}</g><g class="sc-star">{stars}</g>', "tile-sky")


def layer(cls, speed, tile):
    return f'<div class="scene-layer {cls}" data-speed="{speed}">{tile}{tile}{tile}</div>'


html = f'''<div class="scene" data-scene data-anim>
          <div class="scene-ground" aria-hidden="true"></div>
          {layer("layer-sky", 0.025, sky())}
          {layer("layer-far", 0.06, far())}
          {layer("layer-mid", 0.18, mid())}
          {layer("layer-near", 0.55, near())}
          {layer("layer-road", 1, road())}
          <div class="scene-robot" data-robot="hero">{{{{shared:robot-side}}}}</div>
        </div>
'''
OUT.write_text(html, encoding="utf-8")
print("wrote", OUT, f"({len(html) // 1024} KB)")
