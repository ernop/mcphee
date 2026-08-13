from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT_DIR, exist_ok=True)

BG = (31, 36, 48, 255)
PINK = (255, 154, 158, 255)
INK = (245, 245, 245, 255)

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]


def font_path():
    for p in FONT_PATHS:
        if os.path.exists(p):
            return p
    return None


def make_icon(size, out_path):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, size // 16)
    draw.rounded_rectangle(
        [pad, pad, size - pad - 1, size - pad - 1],
        radius=size // 5,
        fill=BG,
    )
    # Pink mark bar — McPhee's misspelling color as the identifying stripe.
    bar_h = max(2, size // 10)
    draw.rectangle([pad, size - pad - bar_h, size - pad - 1, size - pad - 1], fill=PINK)

    fp = font_path()
    text = "M"
    if fp:
        font = ImageFont.truetype(fp, int(size * 0.55))
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = (size - tw) / 2 - bbox[0]
        ty = (size - th) / 2 - bbox[1] - size * 0.04
        draw.text((tx, ty), text, font=font, fill=INK)
    else:
        draw.rectangle([size * 0.3, size * 0.25, size * 0.7, size * 0.7], outline=INK, width=max(2, size // 16))

    img.save(out_path)


for s in (32, 48, 96, 128):
    make_icon(s, os.path.join(OUT_DIR, f"icon-{s}.png"))

print("Wrote icons:", ", ".join(sorted(os.listdir(OUT_DIR))))
