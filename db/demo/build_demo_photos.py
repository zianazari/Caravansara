#!/usr/bin/env python3
"""Build the demo photos: one synthetic JPEG per room tag, plus manifest.json with their sizes.

The images are drawn, not photographed, so they carry no copyright or privacy risk, and they
are kept in git: loading the demo needs neither Pillow nor the internet. `caravansara seed-demo`
puts each file under every listing photo key with that room tag.

Run only when the room tags or sizes change (needs Pillow, once):
    uv run --no-project --with pillow python db/demo/build_demo_photos.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "photos"

# slug: (room tag, width, height, base colour). Varied aspect ratios test the gallery layout.
PHOTOS = {
    "living-room": ("Living room", 1200, 800, (196, 140, 92)),
    "bedroom": ("Bedroom", 1200, 800, (120, 140, 190)),
    "kitchen": ("Kitchen", 1200, 800, (110, 170, 130)),
    "bathroom": ("Bathroom", 800, 1200, (90, 170, 190)),
    "exterior": ("Exterior", 1600, 900, (150, 160, 110)),
    "dining-area": ("Dining area", 1200, 800, (190, 110, 110)),
    "workspace": ("Workspace", 1200, 900, (130, 120, 160)),
    "balcony": ("Balcony", 900, 1200, (200, 170, 90)),
}


def shade(colour, factor):
    return tuple(max(0, min(255, round(c * factor))) for c in colour)


def draw(tag, width, height, colour):
    img = Image.new("RGB", (width, height), colour)
    d = ImageDraw.Draw(img)
    for y in range(height):  # vertical gradient: light top, darker floor
        d.line([(0, y), (width, y)], fill=shade(colour, 1.25 - 0.5 * y / height))
    floor = int(height * 0.72)
    d.rectangle([0, floor, width, height], fill=shade(colour, 0.7))
    # a window and a piece of furniture, scaled to the frame
    w = width // 4
    d.rectangle([width // 8, height // 8, width // 8 + w, height // 8 + int(w * 1.1)], fill=(235, 240, 245),
                outline=shade(colour, 0.5), width=max(4, width // 150))
    d.rounded_rectangle([width // 2, floor - height // 5, width * 7 // 8, floor + height // 30],
                        radius=width // 60, fill=shade(colour, 0.55))
    d.ellipse([width * 5 // 8, height // 6, width * 5 // 8 + width // 10, height // 6 + width // 10],
              fill=(250, 220, 120))
    title = ImageFont.load_default(size=max(48, width // 14))
    small = ImageFont.load_default(size=max(20, width // 45))
    d.text((width // 2, int(height * 0.86)), tag, font=title, fill=(255, 255, 255), anchor="mm",
           stroke_width=3, stroke_fill=shade(colour, 0.4))
    d.text((width - 20, height - 16), "Caravansara demo", font=small, fill=(255, 255, 255), anchor="rd")
    return img


def main():
    OUT.mkdir(exist_ok=True)
    manifest = {}
    for slug, (tag, width, height, colour) in PHOTOS.items():
        path = OUT / f"{slug}.jpg"
        draw(tag, width, height, colour).save(path, "JPEG", quality=82, optimize=True)
        manifest[slug] = {"file": path.name, "room_tag": tag, "width": width, "height": height}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    total = sum(p.stat().st_size for p in OUT.glob("*.jpg"))
    print(f"wrote {len(manifest)} photos to {OUT.relative_to(OUT.parents[2])} ({total // 1024} KB)")


if __name__ == "__main__":
    main()
