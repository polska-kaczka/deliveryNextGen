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
                wins.append(f'<rect x="{wx:.1f}" y="{wy}" width="12" height="18" rx="1.5"'
                            f'{" class=\"sc-lit\"" if lit else ""}/>')
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
                 f'<ellipse class="sc-glow" cx="{lx + 53}" cy="70" rx="40" ry="16"/>')
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
    return svg(h, "".join(g), "tile-near")


def road():
    h = 60
    dashes = "".join(f'<rect x="{x}" y="34" width="64" height="5" rx="2.5"/>' for x in range(30, W, 160))
    return svg(h, f'<rect class="sc-curb" x="0" y="0" width="{W}" height="3"/><g class="sc-dash">{dashes}</g>', "tile-road")


def layer(cls, speed, tile):
    return f'<div class="scene-layer {cls}" data-speed="{speed}">{tile}{tile}{tile}</div>'


html = f'''<div class="scene" data-scene data-anim>
          <div class="scene-ground" aria-hidden="true"></div>
          {layer("layer-far", 0.06, far())}
          {layer("layer-mid", 0.18, mid())}
          {layer("layer-near", 0.55, near())}
          {layer("layer-road", 1, road())}
          <div class="scene-robot" data-robot="hero">{{{{shared:robot-side}}}}</div>
        </div>
'''
OUT.write_text(html, encoding="utf-8")
print("wrote", OUT, f"({len(html) // 1024} KB)")
