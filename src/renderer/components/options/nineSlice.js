/*
	nineSlice.js
	------------

	Shared helpers for the reusable 9-slice / background system.

	One source of truth for the "frame config" shape and for turning a frame
	config into a CSS style object. Both the live widget render AND the
	NineSliceEditorModal preview consume frameStyle() so they always agree.

	A frame config looks like:
	  {
	    slice:   { top, right, bottom, left },  // px sliced from the SOURCE image
	    fill:    true,                          // keep the center slice (border-image fill)
	    border:  { top, right, bottom, left },  // RENDERED frame thickness (px)
	    padding: { top, right, bottom, left },  // inner content padding (px)
	    margin:  { top, right, bottom, left },  // outer margin (px)
	  }

	A "background" is the pairing of a mode + asset + this config:
	  mode  : 'none' | 'sliced' | 'tiled'
	  url   : resolved image URL (served / object URL)
	  scale : tile size in px (tiled mode only)
*/

/**
 * Build a fresh, fully-populated default frame config.
 *
 * @returns {Object} a new default config (safe to mutate)
 */
export function defaultSliceConfig() {
	return {
		slice:   { top: 30, right: 30, bottom: 30, left: 30 },
		fill:    true,
		border:  { top: 30, right: 30, bottom: 30, left: 30 },
		padding: { top: 0, right: 0, bottom: 0, left: 0 },
		margin:  { top: 0, right: 0, bottom: 0, left: 0 },
	};
}


/**
 * Merge a (possibly partial / legacy) config over the defaults so every
 * sub-field is guaranteed present. Never mutates the input.
 *
 * @param {Object} cfg - a partial frame config
 * @returns {Object} a complete frame config
 */
export function normalizeSliceConfig(cfg) {
	const d = defaultSliceConfig();
	if (!cfg || typeof cfg !== 'object') return d;
	const side = (key) => ({ ...d[key], ...(cfg[key] || {}) });
	return {
		slice:   side('slice'),
		fill:    cfg.fill !== undefined ? !!cfg.fill : d.fill,
		border:  side('border'),
		padding: side('padding'),
		margin:  side('margin'),
	};
}


/**
 * Format a {top,right,bottom,left} side object as a CSS shorthand in px.
 *
 * @param {Object} s - side object
 * @returns {String} like "4px 8px 4px 8px"
 */
function sidePx(s) {
	return `${s.top}px ${s.right}px ${s.bottom}px ${s.left}px`;
}


/**
 * Sum of all four sides (used to skip applying a zero override that would
 * otherwise stomp on existing stylesheet padding/margin).
 *
 * @param {Object} s - side object
 * @returns {Number}
 */
function sideSum(s) {
	return (s.top || 0) + (s.right || 0) + (s.bottom || 0) + (s.left || 0);
}


/**
 * Turn a background (mode + url + scale + config) into a CSS style object
 * suitable for binding via :style. Works for the chat box AND each chat row.
 *
 * Returns an EMPTY object for 'none' / missing url, so it never clobbers a
 * widget's default stylesheet (padding, etc.). Zero padding/margin are also
 * omitted for the same reason - only non-zero values are emitted.
 *
 * @param {Object} opts
 * @param {String} opts.mode - 'none' | 'sliced' | 'tiled'
 * @param {String} [opts.url] - resolved image URL
 * @param {Number} [opts.scale] - tile size in px (tiled mode)
 * @param {Object} [opts.config] - frame config (slice/border/padding/margin)
 * @returns {Object} a style object
 */
export function frameStyle({ mode, url, scale, config } = {}) {

	// 'none' (or anything not an image mode) and missing url: no overrides
	if ((mode !== 'sliced' && mode !== 'tiled') || !url)
		return {};

	const cfg = normalizeSliceConfig(config);

	const out = { boxSizing: 'border-box' };
	if (sideSum(cfg.padding) > 0) out.padding = sidePx(cfg.padding);
	if (sideSum(cfg.margin) > 0) out.margin = sidePx(cfg.margin);

	// tiled: repeat the image at a fixed tile size
	if (mode === 'tiled') {
		const px = (Number(scale) > 0) ? Number(scale) : 64;
		out.backgroundImage = `url(${url})`;
		out.backgroundRepeat = 'repeat';
		out.backgroundSize = `${px}px`;
		return out;
	}

	// sliced: 9-slice border-image
	const s = cfg.slice;
	const b = cfg.border;
	out.borderStyle = 'solid';
	out.borderColor = 'transparent';
	out.borderTopWidth = `${b.top}px`;
	out.borderRightWidth = `${b.right}px`;
	out.borderBottomWidth = `${b.bottom}px`;
	out.borderLeftWidth = `${b.left}px`;
	out.borderImageSource = `url(${url})`;
	out.borderImageSlice = `${s.top} ${s.right} ${s.bottom} ${s.left}${cfg.fill ? ' fill' : ''}`;
	out.borderImageWidth = sidePx(b);
	out.borderImageRepeat = 'stretch';
	return out;
}
