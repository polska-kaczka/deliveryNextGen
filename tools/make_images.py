#!/usr/bin/env python3
"""Generate raster brand images (needs Pillow): og-image.png, apple-touch-icon.png, logo.png."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public_html" / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)
BG = (8, 12, 16)


def mark(size, bg=(29, 29, 31), eye=(0, 212, 240)):
    """Logo mark: dark rounded square with two cyan 'sensor eyes'."""
    s = size
    k = s / 32
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(9 * k), fill=bg)
    d.rounded_rectangle([8 * k, 13 * k, 13.5 * k, 20 * k], radius=2.75 * k, fill=eye)
    d.rounded_rectangle([18.5 * k, 13 * k, 24 * k, 20 * k], radius=2.75 * k, fill=eye)
    return img


def font(names, size):
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


def og():
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), (251, 251, 253))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 470, w, h], fill=(245, 245, 247))
    img.paste(mark(72), (80, 72), mark(72))
    bold = font(["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"], 84)
    reg = font(["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"], 32)
    brand = font(["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"], 34)
    d.text((172, 88), "DeliveryNextGen", font=brand, fill=(29, 29, 31))
    d.text((80, 230), "Deliveries that", font=bold, fill=(29, 29, 31))
    d.text((80, 326), "never get stuck.", font=bold, fill=(0, 124, 153))
    d.text((80, 512), "Autonomous last-mile delivery robots  ·  B2B", font=reg, fill=(110, 110, 115))
    img.save(OUT / "og-image.png", optimize=True)


def main():
    og()
    m = mark(512)
    m.save(OUT / "logo.png", optimize=True)
    touch = mark(180).convert("RGB")
    touch.save(OUT / "apple-touch-icon.png", optimize=True)
    print("images written to", OUT)


if __name__ == "__main__":
    main()
