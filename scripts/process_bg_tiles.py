#!/usr/bin/env python3
"""
process_bg_tiles.py
-------------------

Convert the full-opacity, white-background pattern tiles in
`src/renderer/public/assets/bg_tiles/new/` into the faint, transparent
black-on-alpha tiles the UI expects, writing the results into
`src/renderer/public/assets/bg_tiles/` under the same file names.

Each source tile is a dark pattern on a white background. We treat the image as
an inverse alpha mask:

  * white pixels (background)  -> fully transparent
  * black pixels (the pattern) -> fully "inked"
  * grey edge pixels           -> partial alpha (anti-aliasing preserved)

The RGB of every output pixel is solid black; the inverse-luminance mask drives
the alpha. That mask is then scaled down so the darkest pixels land at PEAK_ALPHA
(the alpha the existing tiles use). Measured across the existing tiles, the
"normal" peak is 13/255 (~5%); the page-background tiles (main/main_old/vts) use
a slightly higher value but serve a different role.

Usage:
    python scripts/process_bg_tiles.py [peak_alpha]

    peak_alpha  optional 0-255 override for the dark-pixel opacity (default 13).

Requires: Pillow, numpy.
"""

import os
import sys
import numpy as np
from PIL import Image

# Resolve paths relative to this file so it runs from anywhere.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TILES_DIR = os.path.normpath(
	os.path.join(SCRIPT_DIR, "..", "src", "renderer", "public", "assets", "bg_tiles")
)
NEW_DIR = os.path.join(TILES_DIR, "new")

# Default dark-pixel opacity, measured from the existing tiles (uniform 13/255).
DEFAULT_PEAK_ALPHA = 13

# Rec. 601 luminance weights — turns the coloured/grey pattern into a single
# brightness channel we can invert into a mask.
LUMA = np.array([0.299, 0.587, 0.114], dtype=np.float32)


def convert_tile(src_path, dst_path, peak_alpha):
	"""
	Convert one white-bg pattern tile into a faint transparent black tile.

	@param {str} src_path - source PNG (dark pattern on white).
	@param {str} dst_path - destination PNG path.
	@param {int} peak_alpha - alpha (0-255) the darkest pixels should reach.
	@returns {dict} - small summary of the conversion for logging.
	"""
	img = Image.open(src_path).convert("RGBA")
	arr = np.asarray(img).astype(np.float32)

	rgb = arr[:, :, :3]
	src_a = arr[:, :, 3] / 255.0  # honour any existing transparency in the source

	# Per-pixel luminance (0..255) -> inverse mask (white=0, black=1).
	lum = rgb @ LUMA
	inv_mask = 1.0 - (lum / 255.0)

	# Scale the mask to the target peak and respect any source alpha.
	out_alpha = inv_mask * peak_alpha * src_a
	out_alpha = np.clip(np.rint(out_alpha), 0, 255).astype(np.uint8)

	# Solid black RGB everywhere; the mask lives entirely in the alpha channel.
	h, w = out_alpha.shape
	out = np.zeros((h, w, 4), dtype=np.uint8)
	out[:, :, 3] = out_alpha

	Image.fromarray(out, "RGBA").save(dst_path)

	return {
		"name": os.path.basename(src_path),
		"alpha_max": int(out_alpha.max()),
		"ink_pct": round(float((out_alpha > 0).mean()) * 100, 1),
	}


def main():
	peak = DEFAULT_PEAK_ALPHA
	if len(sys.argv) > 1:
		peak = int(sys.argv[1])
		if not (0 <= peak <= 255):
			sys.exit("peak_alpha must be 0-255")

	if not os.path.isdir(NEW_DIR):
		sys.exit(f"Source folder not found: {NEW_DIR}")

	sources = sorted(
		f for f in os.listdir(NEW_DIR)
		if f.lower().endswith(".png") and os.path.isfile(os.path.join(NEW_DIR, f))
	)
	if not sources:
		sys.exit(f"No PNG tiles found in {NEW_DIR}")

	print(f"Peak alpha: {peak}/255 ({peak / 255 * 100:.1f}% opacity)")
	print(f"Source: {NEW_DIR}")
	print(f"Output: {TILES_DIR}\n")

	for name in sources:
		info = convert_tile(
			os.path.join(NEW_DIR, name),
			os.path.join(TILES_DIR, name),
			peak,
		)
		print(f"  {info['name']:22} -> alpha_max={info['alpha_max']:>3}  ink={info['ink_pct']:>5.1f}%")

	print(f"\nDone. {len(sources)} tile(s) written.")


if __name__ == "__main__":
	main()
