from PIL import Image, ImageDraw, ImageFont
import os

packs = {
    "forest":  { "color": (34, 139, 34),   "label": "🌲" },
    "space":   { "color": (25,  25, 112),   "label": "🚀" },
    "ocean":   { "color": (0,  105, 148),   "label": "🐠" },
}

slots = {
    "card":       (64,  64),
    "column":     (200, 80),
    "overlay":    (400, 300),
    "profile":    (120, 120),
}

base = "frontend/public/sprites"

for pack, info in packs.items():
    for slot, size in slots.items():
        img = Image.new("RGBA", size, (*info["color"], 180))
        draw = ImageDraw.Draw(img)
        draw.rectangle([2, 2, size[0]-3, size[1]-3], outline=(255,255,255,200), width=2)
        draw.text((size[0]//2, size[1]//2), f"{info['label']}\n{slot}",
                  fill=(255,255,255,255), anchor="mm")
        path = f"{base}/{pack}/{slot}.gif"
        img.save(path, "GIF")
        print(f"Created {path}")

print("Done!")
