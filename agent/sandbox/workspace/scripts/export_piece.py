#!/usr/bin/env python3
"""Render an HTML piece to a raster image using headless Chromium (Playwright).

Brand-agnostic: knows nothing about any brand's tokens, colors, or fonts. Captures an exact
width x height clip -- never assumes a square canvas.

Examples:
    python export_piece.py --html piece.html --width 1080 --height 1920 --output out.png
    python export_piece.py --html-string "<html>...</html>" --width 300 --height 250 --output out.jpg --format jpeg
    python export_piece.py --html piece.html --width 1080 --height 1920 --output out.png --scale 2
"""
import argparse
import sys
from io import BytesIO
from pathlib import Path

from playwright.sync_api import sync_playwright

SUPPORTED_FORMATS = {"png", "jpeg", "jpg", "webp"}
# Playwright's page.screenshot() only accepts type="png" or type="jpeg" natively.
NATIVE_FORMATS = {"png", "jpeg"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export an HTML piece to a raster image with an exact pixel clip (width x height)."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--html", type=str, help="Path to an HTML file to render.")
    source.add_argument("--html-string", type=str, help="Inline HTML content to render.")
    parser.add_argument("--width", type=int, required=True, help="Exact clip width in px.")
    parser.add_argument("--height", type=int, required=True, help="Exact clip height in px.")
    parser.add_argument("--output", type=str, required=True, help="Output file path.")
    parser.add_argument(
        "--format",
        type=str,
        default="png",
        choices=sorted(SUPPORTED_FORMATS),
        help="Output image format (default: png). 'jpg' is treated as 'jpeg'.",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=1.0,
        help="Device scale factor for higher-resolution export (e.g. 2 for @2x). Default: 1.0.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=90,
        help="Quality (1-100) for lossy formats (jpeg/webp). Ignored for png. Default: 90.",
    )
    return parser.parse_args()


def _convert_bytes(raw_bytes: bytes, output_path: Path, fmt: str, quality: int) -> None:
    from PIL import Image

    img = Image.open(BytesIO(raw_bytes))
    save_kwargs = {"quality": quality} if fmt == "webp" else {}
    img.save(output_path, fmt.upper(), **save_kwargs)


def main() -> None:
    args = parse_args()

    if args.width <= 0 or args.height <= 0:
        sys.exit(f"error: --width and --height must be positive integers (got {args.width}x{args.height})")
    if not (1 <= args.quality <= 100):
        sys.exit(f"error: --quality must be between 1 and 100 (got {args.quality})")
    if args.scale <= 0:
        sys.exit(f"error: --scale must be positive (got {args.scale})")

    fmt = "jpeg" if args.format == "jpg" else args.format

    html_url = None
    if args.html:
        html_path = Path(args.html).resolve()
        if not html_path.is_file():
            sys.exit(f"error: HTML file not found: {html_path}")
        html_url = html_path.as_uri()

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    native = fmt in NATIVE_FORMATS
    capture_type = fmt if native else "png"  # webp: capture as png, convert after

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            page = browser.new_page(
                viewport={"width": args.width, "height": args.height},
                device_scale_factor=args.scale,
            )
            if html_url:
                page.goto(html_url)
            else:
                page.set_content(args.html_string)
            page.wait_for_load_state("networkidle")

            screenshot_kwargs = {
                "clip": {"x": 0, "y": 0, "width": args.width, "height": args.height},
                "type": capture_type,
            }
            if capture_type == "jpeg":
                screenshot_kwargs["quality"] = args.quality

            if native:
                page.screenshot(path=str(output_path), **screenshot_kwargs)
            else:
                raw_bytes = page.screenshot(**screenshot_kwargs)
                _convert_bytes(raw_bytes, output_path, fmt, args.quality)
        finally:
            browser.close()

    print(f"Exported {output_path} ({args.width}x{args.height}, {fmt})")


if __name__ == "__main__":
    main()
