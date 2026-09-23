#!/usr/bin/env python3
"""Taskbar icon: crystalline A, clean purple ring, transparent canvas."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = [
    ROOT / "assets" / "aetherion-app.png",
    ROOT / "public" / "aetherion-app.png",
    ROOT / "aetherion_app.png",
    Path("/home/workdir/attachments/image.png"),
    Path("/workspace/aetherion_app.png"),
]
OUT_PNG = ROOT / "public" / "aetherion-icon.png"
BUILD_PNG = ROOT / "build" / "icon.png"
BUILD_ICO = ROOT / "build" / "icon.ico"
SIZE = 512
# Purple sampled from the energy around the crystalline A.
RING = (176, 92, 255, 255)


def load_source() -> Image.Image:
    for path in CANDIDATES:
        if path.is_file():
            print(f"source {path}")
            return Image.open(path).convert("RGBA")
    raise SystemExit("Preferred mark not found. Expected public/aetherion-app.png.")


def knock_out_black(image: Image.Image) -> Image.Image:
    """Remove the black matte everywhere. Keep cracks that sit inside the stone A."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    peaks = Image.new("L", (width, height))
    peak_px = peaks.load()
    stone = Image.new("L", (width, height), 0)
    stone_px = stone.load()
    for y in range(height):
        for x in range(width):
            r, g, b, _a = pixels[x, y]
            peak = max(r, g, b)
            peak_px[x, y] = peak
            if peak >= 150:
                stone_px[x, y] = 255
    # Cracks in the letter are dark, but they sit next to the bright stone.
    near_stone = stone.filter(ImageFilter.MaxFilter(9))
    near_px = near_stone.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            peak = peak_px[x, y]
            if near_px[x, y] and peak >= 10:
                pixels[x, y] = (r, g, b, a)
                continue
            if peak < 18:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if peak < 96:
                fade = (peak - 18) / 78
                fade = fade * fade
                pixels[x, y] = (r, g, b, int(a * fade))
                continue
            pixels[x, y] = (r, g, b, a)
    return image


def circular_mask(size: int, inset: int, feather: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((inset, inset, size - 1 - inset, size - 1 - inset), fill=255)
    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return mask


def main() -> None:
    mark = knock_out_black(load_source())
    bbox = mark.getbbox()
    if not bbox:
        raise SystemExit("Mark has no visible pixels after removing the black matte.")
    mark = mark.crop(bbox)

    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    # Leave room for a clean ring outside the artwork.
    inner = int(SIZE * 0.74)
    mark.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    origin = ((SIZE - mark.width) // 2, (SIZE - mark.height) // 2)

    glow = mark.filter(ImageFilter.GaussianBlur(10))
    glow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow_layer.paste(glow, origin, glow)
    # Soft glow stays inside the ring and never paints an opaque square.
    alpha = glow_layer.getchannel("A").point(lambda v: int(v * 0.45))
    glow_layer.putalpha(alpha)
    canvas.alpha_composite(glow_layer)
    canvas.alpha_composite(mark, origin)

    # Clip everything to a circle so leftover matte cannot form a square.
    clip = circular_mask(SIZE, inset=36, feather=2)
    clipped = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    clipped.paste(canvas, (0, 0), clip)
    canvas = clipped

    draw = ImageDraw.Draw(canvas)
    inset = 28
    box = (inset, inset, SIZE - 1 - inset, SIZE - 1 - inset)
    # Soft halo under the stroke, then one clean ring.
    for grow, alpha in ((8, 50), (4, 90)):
        halo = (
            inset - grow,
            inset - grow,
            SIZE - 1 - inset + grow,
            SIZE - 1 - inset + grow,
        )
        draw.ellipse(halo, outline=(*RING[:3], alpha), width=6)
    draw.ellipse(box, outline=RING, width=14)

    # Corners of the taskbar tile must be empty.
    for point in ((0, 0), (SIZE - 1, 0), (0, SIZE - 1), (SIZE - 1, SIZE - 1)):
        if canvas.getpixel(point)[3] != 0:
            raise SystemExit(f"Corner {point} is not transparent: {canvas.getpixel(point)}")

    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    BUILD_PNG.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_PNG)
    canvas.save(BUILD_PNG)
    canvas.save(
        BUILD_ICO,
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"wrote {OUT_PNG} {BUILD_PNG} {BUILD_ICO}")


if __name__ == "__main__":
    main()
