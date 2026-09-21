#!/usr/bin/env python3
"""Scale/resize an existing image. Brand-agnostic.

Uses Image.LANCZOS resampling -- the same resampling this ecosystem's own engine already uses for
downscaled previews (hit_core.save_preview).

Examples:
    python scale_image.py --input piece.png --output piece_small.png --width 540
    python scale_image.py --input piece.png --output piece_small.png --height 960
    python scale_image.py --input piece.png --output piece_2x.png --scale 2.0
    python scale_image.py --input piece.png --output thumb.jpg --width 300 --height 300
"""
import argparse
import sys
from pathlib import Path

from PIL import Image


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scale an image by an explicit width/height, or by a uniform factor."
    )
    parser.add_argument("--input", type=str, required=True, help="Path to the source image.")
    parser.add_argument("--output", type=str, required=True, help="Path to write the scaled image.")
    parser.add_argument(
        "--width", type=int, help="Target width in px. If --height is omitted, aspect ratio is preserved."
    )
    parser.add_argument(
        "--height", type=int, help="Target height in px. If --width is omitted, aspect ratio is preserved."
    )
    parser.add_argument(
        "--scale", type=float, help="Uniform scale factor (e.g. 0.5, 2.0). Mutually exclusive with --width/--height."
    )
    parser.add_argument(
        "--format",
        type=str,
        default=None,
        help="Force an output format (png/jpeg/webp/...). Defaults to inferring from --output's extension.",
    )
    parser.add_argument("--quality", type=int, default=90, help="Quality (1-100) for lossy formats. Default: 90.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.scale is not None and (args.width or args.height):
        sys.exit("error: --scale is mutually exclusive with --width/--height")
    if args.scale is None and not args.width and not args.height:
        sys.exit("error: provide --scale, or at least one of --width/--height")
    if not (1 <= args.quality <= 100):
        sys.exit(f"error: --quality must be between 1 and 100 (got {args.quality})")

    input_path = Path(args.input).resolve()
    if not input_path.is_file():
        sys.exit(f"error: input image not found: {input_path}")

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    img = Image.open(input_path)
    src_w, src_h = img.size

    if args.scale is not None:
        if args.scale <= 0:
            sys.exit(f"error: --scale must be positive (got {args.scale})")
        target_w = round(src_w * args.scale)
        target_h = round(src_h * args.scale)
    elif args.width and args.height:
        target_w, target_h = args.width, args.height
    elif args.width:
        target_w = args.width
        target_h = round(src_h * (args.width / src_w))
    else:
        target_h = args.height
        target_w = round(src_w * (args.height / src_h))

    if target_w <= 0 or target_h <= 0:
        sys.exit(f"error: computed target size is invalid ({target_w}x{target_h})")

    resized = img.resize((target_w, target_h), Image.LANCZOS)

    fmt = (args.format or output_path.suffix.lstrip(".") or "png").lower()
    fmt = "JPEG" if fmt in ("jpg", "jpeg") else fmt.upper()

    if fmt == "JPEG" and resized.mode in ("RGBA", "P"):
        resized = resized.convert("RGB")

    save_kwargs = {"quality": args.quality} if fmt in ("JPEG", "WEBP") else {}
    resized.save(output_path, fmt, **save_kwargs)

    print(f"Scaled {input_path.name} ({src_w}x{src_h}) -> {output_path} ({target_w}x{target_h}, {fmt})")


if __name__ == "__main__":
    main()
