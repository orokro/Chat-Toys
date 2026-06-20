<!--
	FireworkCanvas.vue
	------------------

	Canvas renderer for EmojiFountain 'firework' particles.

	A firework particle (see EmojiFountain.js header) describes a rocket that
	launches from the bottom of the screen, climbs to a burst point, then
	explodes. This component owns the whole visual:

		1. Rocket phase  - the chosen emoji rides a 🚀 glyph up to the apex,
		   leaving a short sparkly trail.
		2. Transition    - a bright flash ring + smoke cloud puff at the apex
		   (the "explosion / cloud" hand-off from rocket to burst).
		3. Burst phase   - the emoji is sampled into a grid of colored pixels;
		   each pixel becomes a spark that flies outward to rebuild the emoji
		   much larger, then gravity pulls the sparks down as they fade.

	The other render modes (rain / toss / fountain) are unaffected - they keep
	rendering as DOM elements in EmojiFountainWidget.vue. This component only
	ever looks at particles whose type === 'firework', handed in via `events`.

	Sampling uses cached (blob) emoji sources when available so the source
	canvas stays CORS-clean; if a pixel read is blocked (tainted) or the asset
	fails, we fall back to a generic warm-colored burst so the firework still
	plays.
-->
<template>

	<div ref="wrapper" class="firework-canvas-wrap">
		<canvas ref="canvas"></canvas>
	</div>

</template>
<script setup>

// vue
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

// emoji cache helper (prefers CORS-clean blob URLs)
import { getEmojiSource } from '../../emojiCache.js';

const props = defineProps({
	// Array of firework particles (type === 'firework') to animate.
	events: {
		type: Array,
		default: () => []
	},
	// Live toy settings snapshot ({ emojiSize, speed, fireworkDetail, ... }).
	settings: {
		type: Object,
		default: () => ({})
	}
});

// ---------- element refs ----------

const wrapper = ref(null);
const canvas = ref(null);

// ---------- non-reactive engine state ----------

let ctx = null;				// 2d context
let dpr = 1;				// device pixel ratio
let cssW = 0;				// canvas CSS width  (px)
let cssH = 0;				// canvas CSS height (px)
let rafId = null;			// requestAnimationFrame handle
let resizeObserver = null;

// Active animations keyed by firework id.
const anims = new Map();

// Ids we've already started so the same socket particle doesn't replay every
// time the `events` array reference changes.
const seen = new Set();

// Pixels read from a source this many (per axis) when no detail given.
const DEFAULT_GRID = 18;

// Seconds the burst takes to expand outward to the full-size emoji (the "peak"),
// after which the user-controlled fall duration takes over.
const BLOOM_TIME = 0.45;

// Emote-image hosts whose CDN doesn't send CORS headers. A plain <img> (used by
// rain/toss/fountain) can display them fine, but drawing one into a canvas to
// read its pixels taints the canvas and getImageData throws - so the firework
// burst could never sample the emoji. For these we route the load through the
// app's own /emote-proxy (same-origin, CORS-clean), exactly like the Tosser.
// BetterTTV is the known offender; the list is easy to extend.
const PROXY_EMOTE_HOSTS = ['betterttv.net'];

/**
 * Rewrite an emote image URL to load through the local /emote-proxy when its
 * host is known to lack CORS headers; otherwise return it unchanged.
 *
 * @param {string} url - the original emote image URL
 * @returns {string}
 */
function emoteLoadUrl(url) {
	try {
		const u = new URL(url, window.location.href);
		const needsProxy = (u.protocol === 'http:' || u.protocol === 'https:') &&
			PROXY_EMOTE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
		if (needsProxy)
			return '/emote-proxy?url=' + encodeURIComponent(url);
	} catch (e) {
		/* not a parseable URL — fall through and use as-is */
	}
	return url;
}

// Resolution of the offscreen sampling canvas (downsampled into the grid).
const SAMPLE_RES = 64;

// Reusable offscreen canvas for pixel sampling.
let sampleCanvas = null;
let sampleCtx = null;

// ---------- small math helpers ----------

/**
 * Linear interpolation.
 * @param {number} a - start
 * @param {number} b - end
 * @param {number} t - 0..1
 * @returns {number}
 */
function lerp(a, b, t) {
	return a + (b - a) * t;
}

/**
 * Clamp a value into [min, max].
 * @param {number} v - value
 * @param {number} min - lower bound
 * @param {number} max - upper bound
 * @returns {number}
 */
function clamp(v, min, max) {
	return v < min ? min : v > max ? max : v;
}

/**
 * Ease-out (decelerating) curve.
 * @param {number} t - 0..1
 * @returns {number}
 */
function easeOut(t) {
	const x = clamp(t, 0, 1);
	return 1 - (1 - x) * (1 - x);
}

// ---------- emoji pixel sampling ----------

/**
 * Lazily create the shared offscreen sampling canvas.
 * @returns {void}
 */
function ensureSampleCanvas() {
	if (sampleCtx) return;
	sampleCanvas = document.createElement('canvas');
	sampleCanvas.width = SAMPLE_RES;
	sampleCanvas.height = SAMPLE_RES;
	sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
}

/**
 * Reduce a SAMPLE_RES×SAMPLE_RES ImageData down to a grid×grid set of colored
 * points, dropping near-transparent cells. Each point's nx/ny is its offset
 * from the emoji center in the range [-0.5, 0.5].
 *
 * @param {ImageData} data - source pixels (SAMPLE_RES square)
 * @param {number} grid - target sample resolution per axis
 * @returns {Array<{nx:number, ny:number, r:number, g:number, b:number, a:number}>}
 */
function binImageData(data, grid) {

	const pts = [];
	const px = data.data;
	const block = SAMPLE_RES / grid;

	for (let gy = 0; gy < grid; gy++) {
		for (let gx = 0; gx < grid; gx++) {

			// average the pixels inside this cell
			let r = 0, g = 0, b = 0, a = 0, n = 0;

			const x0 = Math.floor(gx * block);
			const x1 = Math.floor((gx + 1) * block);
			const y0 = Math.floor(gy * block);
			const y1 = Math.floor((gy + 1) * block);

			for (let y = y0; y < y1; y++) {
				for (let x = x0; x < x1; x++) {
					const i = (y * SAMPLE_RES + x) * 4;
					const pa = px[i + 3] / 255;
					if (pa <= 0) continue;
					// weight color by alpha so edges don't pull toward black
					r += px[i] * pa;
					g += px[i + 1] * pa;
					b += px[i + 2] * pa;
					a += pa;
					n++;
				}
			}

			if (n === 0 || a <= 0) continue;

			const avgA = a / n;
			if (avgA < 0.35) continue;	// skip mostly-empty cells

			pts.push({
				nx: (gx + 0.5) / grid - 0.5,
				ny: (gy + 0.5) / grid - 0.5,
				// fixed per-spark random unit offset; scaled live by the jitter
				// setting at draw time so the shape stays stable frame to frame
				jx: Math.random() * 2 - 1,
				jy: Math.random() * 2 - 1,
				r: Math.round(r / a),
				g: Math.round(g / a),
				b: Math.round(b / a),
				a: clamp(avgA, 0, 1)
			});
		}
	}

	return pts;
}

/**
 * Generic warm-colored fallback burst used when an emoji can't be sampled
 * (image still loading uncached / tainted / failed). Points fill a disc so the
 * firework still reads as a firework.
 *
 * @returns {Array<{nx:number, ny:number, r:number, g:number, b:number, a:number}>}
 */
function fallbackPoints() {

	const pts = [];
	const count = 120;
	const hueBase = Math.random() * 360;

	for (let i = 0; i < count; i++) {
		// random point inside a unit disc, scaled to [-0.5, 0.5]
		const ang = Math.random() * Math.PI * 2;
		const rad = Math.sqrt(Math.random()) * 0.5;
		const hue = (hueBase + Math.random() * 50) % 360;
		const [r, g, b] = hslToRgb(hue / 360, 0.9, 0.6);
		pts.push({
			nx: Math.cos(ang) * rad,
			ny: Math.sin(ang) * rad,
			jx: Math.random() * 2 - 1,
			jy: Math.random() * 2 - 1,
			r, g, b,
			a: 1
		});
	}

	return pts;
}

/**
 * HSL -> RGB (0..255). Used only by the fallback burst.
 * @param {number} h - 0..1
 * @param {number} s - 0..1
 * @param {number} l - 0..1
 * @returns {[number, number, number]}
 */
function hslToRgb(h, s, l) {
	let r, g, b;
	if (s === 0) {
		r = g = b = l;
	} else {
		const hue2rgb = (p, q, t) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Draw the source (image or glyph) onto the sampling canvas and bin it.
 * Returns the fallback burst if the read is blocked or nothing usable remains.
 *
 * @param {Object} anim - animation instance (with .kind / .img / .char)
 * @param {number} grid - sample resolution per axis
 * @returns {Array<{nx:number, ny:number, r:number, g:number, b:number, a:number}>}
 */
function samplePoints(anim, grid) {

	ensureSampleCanvas();
	sampleCtx.clearRect(0, 0, SAMPLE_RES, SAMPLE_RES);

	try {
		if (anim.kind === 'image' && anim.img) {
			sampleCtx.drawImage(anim.img, 0, 0, SAMPLE_RES, SAMPLE_RES);
		} else if (anim.char) {
			sampleCtx.textAlign = 'center';
			sampleCtx.textBaseline = 'middle';
			sampleCtx.font = `${Math.floor(SAMPLE_RES * 0.82)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
			sampleCtx.fillText(anim.char, SAMPLE_RES / 2, SAMPLE_RES / 2);
		} else {
			return fallbackPoints();
		}

		const data = sampleCtx.getImageData(0, 0, SAMPLE_RES, SAMPLE_RES);
		const pts = binImageData(data, grid);
		return pts.length ? pts : fallbackPoints();
	}
	catch (e) {
		// tainted canvas (CORS) or read failure -> generic burst
		return fallbackPoints();
	}
}

// ---------- spawning animations from events ----------

/**
 * Load the emoji asset for an event, sample it, and register a live animation.
 * The animation clock only starts once the asset is resolved so the rocket and
 * its matching sparks always appear together.
 *
 * @param {Object} event - firework particle
 * @returns {void}
 */
function spawnFrom(event) {

	const grid = Math.round(props.settings?.fireworkDetail || DEFAULT_GRID);

	const anim = {
		id: event.id,
		event,
		kind: event.url ? 'image' : 'char',
		img: null,
		char: event.char || null,
		points: null,
		trail: [],
		startTime: 0
	};

	/**
	 * Finish setup once the asset (if any) is ready, then go live.
	 * @returns {void}
	 */
	const begin = () => {
		anim.points = samplePoints(anim, clamp(grid, 6, 40));
		anim.startTime = performance.now();
		anims.set(anim.id, anim);
		ensureRaf();
	};

	if (anim.kind === 'image') {
		// Route CORS-less CDNs (e.g. BetterTTV) through the same-origin proxy so
		// the sampling canvas isn't tainted; then prefer a cached (blob) source
		// for clean sampling, falling back to the (proxied) URL.
		const loadUrl = emoteLoadUrl(event.url);
		getEmojiSource(loadUrl)
			.then(({ src }) => loadImage(src))
			.catch(() => loadImage(loadUrl))
			.then((img) => { anim.img = img; })
			.catch(() => { /* keep img null -> fallback burst + no rocket sprite */ })
			.finally(begin);
	}
	else {
		begin();
	}
}

/**
 * Promise wrapper around Image loading (CORS-anonymous so blob/CDN images can
 * be drawn into a readable canvas where the host allows it).
 *
 * @param {string} src - image source URL
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

/**
 * Diff the incoming events against what we've already started and spawn any
 * new fireworks. Also prunes the `seen` set so it can't grow without bound.
 *
 * @param {Array<Object>} events - current firework particles
 * @returns {void}
 */
function ingest(events) {

	const list = Array.isArray(events) ? events : [];

	for (const ev of list) {
		if (!ev || !ev.id) continue;
		if (ev.type && ev.type !== 'firework') continue;
		if (seen.has(ev.id)) continue;
		seen.add(ev.id);
		spawnFrom(ev);
	}

	// keep `seen` bounded: rebuild from what's still relevant
	if (seen.size > 400) {
		const keep = new Set(anims.keys());
		for (const ev of list) if (ev && ev.id) keep.add(ev.id);
		seen.clear();
		for (const id of keep) seen.add(id);
	}
}

// ---------- rendering ----------

/**
 * Resize the backing canvas to match its CSS box and the device pixel ratio.
 * @returns {void}
 */
function resize() {
	if (!canvas.value || !wrapper.value) return;
	const rect = wrapper.value.getBoundingClientRect();
	cssW = Math.max(1, rect.width);
	cssH = Math.max(1, rect.height);
	dpr = Math.max(1, window.devicePixelRatio || 1);
	canvas.value.width = Math.round(cssW * dpr);
	canvas.value.height = Math.round(cssH * dpr);
	if (!ctx) ctx = canvas.value.getContext('2d');
}

/**
 * Start the animation loop if it isn't already running.
 * @returns {void}
 */
function ensureRaf() {
	if (rafId == null && ctx) {
		rafId = requestAnimationFrame(loop);
	}
}

/**
 * Main animation frame: clear, draw every live firework, drop finished ones,
 * and idle the loop when nothing is left to draw.
 *
 * @param {number} now - high-res timestamp from rAF
 * @returns {void}
 */
function loop(now) {

	rafId = null;

	if (!ctx) return;

	// work in CSS pixels regardless of DPR
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, cssW, cssH);

	for (const anim of anims.values()) {
		const alive = drawAnim(anim, now);
		if (!alive) anims.delete(anim.id);
	}

	if (anims.size > 0) {
		rafId = requestAnimationFrame(loop);
	}
}

/**
 * Draw one firework for the current frame.
 *
 * @param {Object} anim - animation instance
 * @param {number} now - high-res timestamp
 * @returns {boolean} true while still animating, false when finished
 */
function drawAnim(anim, now) {

	const ev = anim.event;
	const t = (now - anim.startTime) / 1000;	// seconds since launch

	const launchDur = ev.launchDuration || 1.2;

	// Burst lifetime is driven by settings, not the particle: a fixed bloom
	// (outward expansion to the full emoji) plus the user's "fall duration"
	// (peak -> sparks shrunk to nothing).
	const bloomT = BLOOM_TIME;
	const fallDuration = clamp(props.settings?.fireworkFallDuration ?? 1.4, 0.2, 6);
	const explodeDur = bloomT + fallDuration;

	if (t >= launchDur + explodeDur) return false;

	// geometry in CSS px
	const minWH = Math.min(cssW, cssH);
	const effScale = clamp(ev.scale || props.settings?.emojiSize || 1, 0.2, 3);

	const startX = (ev.startX / 100) * cssW;
	const startY = (ev.startY / 100) * cssH;	// just below bottom
	const burstX = (ev.apexX / 100) * cssW;
	const burstY = (ev.apexY / 100) * cssH;

	if (t < launchDur) {
		drawRocket(anim, t / launchDur, startX, startY, burstX, burstY, minWH, effScale);
	}
	else {
		const te = t - launchDur;
		drawBurst(anim, te, bloomT, fallDuration, burstX, burstY, minWH, effScale);
	}

	return true;
}

/**
 * Draw the rocket climbing toward its apex, plus a short fading spark trail.
 *
 * @param {Object} anim - animation instance
 * @param {number} p - launch progress 0..1
 * @param {number} sx - launch x (px)
 * @param {number} sy - launch y (px)
 * @param {number} bx - burst x (px)
 * @param {number} by - burst y (px)
 * @param {number} minWH - min(canvas w, h)
 * @param {number} scale - effective emoji scale
 * @returns {void}
 */
function drawRocket(anim, p, sx, sy, bx, by, minWH, scale) {

	const x = lerp(sx, bx, p);
	const y = lerp(sy, by, easeOut(p));		// decelerate near the top

	// record trail point
	anim.trail.push({ x, y });
	if (anim.trail.length > 10) anim.trail.shift();

	// trail (oldest = faintest)
	for (let i = 0; i < anim.trail.length; i++) {
		const tp = anim.trail[i];
		const f = (i + 1) / anim.trail.length;
		ctx.beginPath();
		ctx.fillStyle = `rgba(255, ${Math.round(200 + 55 * f)}, 120, ${0.35 * f})`;
		ctx.arc(tp.x, tp.y + minWH * 0.03, Math.max(1, minWH * 0.012 * f), 0, Math.PI * 2);
		ctx.fill();
	}

	const sz = minWH * 0.06 * scale;

	// rocket glyph beneath the emoji, rotated so its nose points up.
	// NOTE: the trail loop above left ctx.fillStyle as a translucent rgba.
	// Color-emoji glyphs honor the fill alpha, so we MUST reset to a fully
	// opaque paint here or the rocket renders semi-transparent.
	ctx.save();
	ctx.globalAlpha = 1;
	ctx.fillStyle = '#000';
	ctx.translate(x, y + sz * 0.7);
	ctx.rotate(-Math.PI / 4);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `${sz * 0.9}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
	ctx.fillText('🚀', 0, 0);
	ctx.restore();

	// the chosen emoji riding on top
	drawEmojiSprite(anim, x, y, sz);
}

/**
 * Draw the emoji sprite (image or glyph) centered at (x, y).
 *
 * @param {Object} anim - animation instance
 * @param {number} x - center x (px)
 * @param {number} y - center y (px)
 * @param {number} sz - draw size (px)
 * @returns {void}
 */
function drawEmojiSprite(anim, x, y, sz) {
	if (anim.kind === 'image' && anim.img) {
		// drawImage ignores fillStyle, so image emotes are always opaque.
		ctx.drawImage(anim.img, x - sz / 2, y - sz / 2, sz, sz);
	}
	else if (anim.char) {
		// Reset paint: the trail/burst may have left fillStyle translucent, and
		// color-emoji glyphs honor the fill alpha - without this the emoji would
		// render semi-transparent.
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#000';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `${sz}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
		ctx.fillText(anim.char, x, y);
	}
}

/**
 * Draw the burst: a transition flash/cloud, then the emoji rebuilt out of
 * colored sparks. The sparks bloom outward to full size, then (measured from
 * that peak) fall under gravity while shrinking to nothing.
 *
 * Three settings shape this:
 *   - fireworkParticleScale : multiplies each spark's radius (on top of the
 *     detail-based sizing) so packed-in sparks can be made smaller/larger.
 *   - fireworkFallSpeed     : multiplies gravity (how fast sparks fall).
 *   - fireworkFallDuration  : seconds from the burst peak until the spark has
 *     shrunk to 0 (passed in as `fallDuration`).
 *
 * @param {Object} anim - animation instance
 * @param {number} te - seconds since the burst began
 * @param {number} bloomT - seconds for the outward expansion (peak) to complete
 * @param {number} fallDuration - seconds from peak until sparks shrink to 0
 * @param {number} cx - burst center x (px)
 * @param {number} cy - burst center y (px)
 * @param {number} minWH - min(canvas w, h)
 * @param {number} scale - effective emoji scale
 * @returns {void}
 */
function drawBurst(anim, te, bloomT, fallDuration, cx, cy, minWH, scale) {

	const bigSize = minWH * 0.5 * scale;	// diameter of the rebuilt emoji

	const sizeScale = clamp(props.settings?.fireworkParticleScale ?? 1, 0.1, 6);
	const fallSpeed = clamp(props.settings?.fireworkFallSpeed ?? 1, 0.05, 6);
	const grav = minWH * 0.6 * fallSpeed;	// px / s^2

	// --- transition: smoke cloud puff (drawn first, behind sparks) ---
	if (te < 0.6) {
		const cp = te / 0.6;
		const cr = bigSize * (0.25 + 0.55 * cp);
		const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
		grd.addColorStop(0, `rgba(220,220,220,${0.18 * (1 - cp)})`);
		grd.addColorStop(1, 'rgba(220,220,220,0)');
		ctx.fillStyle = grd;
		ctx.beginPath();
		ctx.arc(cx, cy, cr, 0, Math.PI * 2);
		ctx.fill();
	}

	// --- transition: bright flash ring + core (additive) ---
	if (te < 0.22) {
		const fp = te / 0.22;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';

		// expanding ring
		ctx.beginPath();
		ctx.strokeStyle = `rgba(255,245,210,${0.9 * (1 - fp)})`;
		ctx.lineWidth = lerp(6, 1, fp);
		ctx.arc(cx, cy, lerp(0, bigSize * 0.55, fp), 0, Math.PI * 2);
		ctx.stroke();

		// hot core
		const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, bigSize * 0.4);
		core.addColorStop(0, `rgba(255,255,240,${0.85 * (1 - fp)})`);
		core.addColorStop(1, 'rgba(255,255,240,0)');
		ctx.fillStyle = core;
		ctx.beginPath();
		ctx.arc(cx, cy, bigSize * 0.4, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	// --- sparks rebuilding the emoji ---
	const pts = anim.points || [];
	if (!pts.length) return;

	const grid = clamp(Math.round(props.settings?.fireworkDetail || DEFAULT_GRID), 6, 40);
	const cell = bigSize / grid;
	const sparkR = Math.max(0.5, cell * 0.5) * sizeScale;

	// per-spark jitter off its grid spot, in px (a fraction of a grid cell)
	const jitterAmt = clamp(props.settings?.fireworkJitter ?? 0.25, 0, 2);
	const jitterPx = jitterAmt * cell;

	// Outward expansion (bloom) up to the peak at te === bloomT.
	const exP = easeOut(clamp(te / bloomT, 0, 1));

	// Fall phase, measured from the peak: 0 at the peak, 1 when fully gone.
	const tFall = Math.max(0, te - bloomT);
	const fp = clamp(tFall / fallDuration, 0, 1);

	// Radius shrinks to 0 across the fall; sparks accelerate downward.
	const rNow = sparkR * (1 - fp);
	if (rNow <= 0.05) return;
	const gy = 0.5 * grav * tFall * tFall;

	// Quick ignite fade-in (masks the pop) and a gentle fade over the fall tail.
	const fadeIn = clamp(te / 0.06, 0, 1);
	const fadeOut = fp > 0.6 ? clamp(1 - (fp - 0.6) / 0.4, 0, 1) : 1;
	const globalA = fadeIn * fadeOut;
	if (globalA <= 0) return;

	for (let i = 0; i < pts.length; i++) {
		const pt = pts[i];
		const x = cx + (pt.nx * bigSize + (pt.jx || 0) * jitterPx) * exP;
		const y = cy + (pt.ny * bigSize + (pt.jy || 0) * jitterPx) * exP + gy;
		const a = clamp(pt.a * globalA, 0, 1);
		if (a <= 0.02) continue;
		ctx.beginPath();
		ctx.fillStyle = `rgba(${pt.r},${pt.g},${pt.b},${a})`;
		ctx.arc(x, y, rNow, 0, Math.PI * 2);
		ctx.fill();
	}
}

// ---------- lifecycle ----------

// React to new firework events without disturbing in-flight ones.
watch(
	() => props.events,
	(events) => {
		ingest(events);
	},
	{ immediate: true, deep: false }
);

onMounted(() => {
	resize();
	// pick up any events that arrived before the canvas was ready
	ingest(props.events);

	if (wrapper.value && typeof window !== 'undefined' && window.ResizeObserver) {
		resizeObserver = new ResizeObserver(() => resize());
		resizeObserver.observe(wrapper.value);
	}
	else if (typeof window !== 'undefined') {
		window.addEventListener('resize', resize);
	}
});

onBeforeUnmount(() => {
	if (rafId != null) cancelAnimationFrame(rafId);
	rafId = null;
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
	else if (typeof window !== 'undefined') {
		window.removeEventListener('resize', resize);
	}
	anims.clear();
});

</script>
<style scoped lang="scss">

	.firework-canvas-wrap {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: clip;

		canvas {
			display: block;
			width: 100%;
			height: 100%;
		}
	} // .firework-canvas-wrap

</style>
