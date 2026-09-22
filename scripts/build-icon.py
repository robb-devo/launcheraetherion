#!/usr/bin/env python3
"""Build a transparent taskbar icon: crystalline A inside a purple ring."""

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "aetherion-logo.jpg"
PNG = ROOT / "public" / "aetherion-icon.png"
BUILD_PNG = ROOT / "build" / "icon.png"
BUILD_ICO = ROOT / "build" / "icon.ico"
SIZE = 512
RING = (176, 132, 255, 255)


def is_background(r: int, g: int, b: int) -> bool:
    return r < 28 and g < 26 and b < 34


def knock_out_background(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        index = y * width + x
        if seen[index]:
            continue
        seen[index] = 1
        r, g, b, _alpha = pixels[x, y]
        if not is_background(r, g, b):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return image


def main() -> None:
    mark = knock_out_background(Image.open(SOURCE))
    bbox = mark.getbbox()
    if not bbox:
        raise SystemExit("Logo has no visible pixels.")
    mark = mark.crop(bbox)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    inner = int(SIZE * 0.62)
    mark.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark, ((SIZE - mark.width) // 2, (SIZE - mark.height) // 2))
    draw = ImageDraw.Draw(canvas)
    inset = 18
    draw.ellipse((inset, inset, SIZE - 1 - inset, SIZE - 1 - inset), outline=RING, width=18)
    PNG.parent.mkdir(parents=True, exist_ok=True)
    BUILD_PNG.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(PNG)
    canvas.save(BUILD_PNG)
    canvas.save(
        BUILD_ICO,
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
