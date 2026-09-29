<!--
	DanceCanvas.vue
	---------------

	Canvas renderer for EmojiFountain 'dance' particles (the !dance command):
	stick-figure dancers with the chatter's emoji as their head, shirt and
	pants colored from that emoji, tossed in from below, dancing whole loops
	of a dance from dances.json, then hopping off.

	Costs nothing while nobody is dancing: the dance data is only loaded the
	first time a dancer shows up, and the animation loop only runs while at
	least one dancer is on screen (it stops itself when the last one leaves).

	Timing comes from the particle (see dances/danceCrew.js); positions are
	% of the widget, so every copy of the widget shows the same dance.
-->
<template>

	<div ref="wrapper" class="dance-canvas-wrap">
		<canvas ref="canvas"></canvas>
	</div>

</template>
<script setup>

// vue
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

// dances
import { decodeDance, samplePose, drawDancer } from '../dances/danceDraw.js';
import { pickOutfit, fallbackOutfit } from '../dances/outfit.js';
import { TOSS_IN, TOSS_OUT } from '../dances/danceCrew.js';

// shared emoji loading / pixel reading
import { loadEmojiImage, rasterize, EMOJI_FONT } from './emojiSampler.js';

const props = defineProps({
	// dance particles (type === 'dance')
	events: {
		type: Array,
		default: () => []
	},
	// live toy settings snapshot
	settings: {
		type: Object,
		default: () => ({})
	}
});

// ---------- element refs ----------

const wrapper = ref(null);
const canvas = ref(null);

// ---------- non-reactive engine state ----------

let ctx = null;
let dpr = 1;
let cssW = 0;
let cssH = 0;
let rafId = null;
let resizeObserver = null;

// live dancers by particle id
const anims = new Map();
const seen = new Set();

// the dance loops, loaded the first time anyone dances
let danceDocPromise = null;
const decoded = new Map();

// emoji -> { img, outfit } (bounded)
const looks = new Map();
const MAX_LOOKS = 100;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);


/**
 * The dance loops (dances.json is its own chunk, fetched on first use).
 * @returns {Promise<Object>}
 */
function danceDoc() {
	if (!danceDocPromise) {
		danceDocPromise = import('../dances/dances.json')
			.then((m) => m.default || m)
			.catch((e) => {
				danceDocPromise = null;
				throw e;
			});
	}
	return danceDocPromise;
}


/**
 * @param {Object} doc
 * @param {string} id
 * @returns {?Object} decoded dance (cached)
 */
function getDance(doc, id) {
	if (!decoded.has(id)) {
		const d = decodeDance(doc, id) || decodeDance(doc, doc.order[0]);
		if (d) d.travel = (doc.dances[d.id] && doc.dances[d.id].travel) || 0;
		decoded.set(id, d);
	}
	return decoded.get(id);
}


/**
 * The head image (if any) and outfit colors for an emoji, loaded once.
 * @param {Object} ev - particle ({ url } or { char })
 * @returns {Promise<{img: ?HTMLImageElement, char: ?string, outfit: {shirt, pants}}>}
 */
function getLook(ev) {
	const key = ev.url || ev.char || '?';
	if (looks.has(key)) return looks.get(key);
	const p = (ev.url ? loadEmojiImage(ev.url) : Promise.resolve(null)).then((img) => {
		const data = rasterize({ img, char: ev.url ? null : ev.char }, 32);
		const outfit = (data && pickOutfit(data.data)) || fallbackOutfit(key);
		return { img, char: ev.url ? null : ev.char, outfit };
	});
	looks.set(key, p);
	if (looks.size > MAX_LOOKS) looks.delete(looks.keys().next().value);
	return p;
}


/**
 * Start a dancer once its dance and look are ready.
 * @param {Object} ev - dance particle
 */
function spawnFrom(ev) {
	Promise.all([danceDoc(), getLook(ev)])
		.then(([doc, look]) => {
			const dance = getDance(doc, ev.dance);
			if (!dance) return;
			// the particle's clock: seconds since the toy created it
			const origin = performance.now() - (Date.now() - (ev.createdAt || Date.now()));
			if ((performance.now() - origin) / 1000 >= ev.duration) return; // already over
			anims.set(ev.id, { ev, dance, look, origin, pose: new Float32Array(64) });
			ensureRaf();
		})
		.catch(() => { /* no dance data: skip */ });
}


/**
 * Start any dancers we haven't seen yet.
 * @param {Array<Object>} events
 */
function ingest(events) {
	const list = Array.isArray(events) ? events : [];
	for (const ev of list) {
		if (!ev || !ev.id || ev.type !== 'dance' || seen.has(ev.id)) continue;
		seen.add(ev.id);
		spawnFrom(ev);
	}
	if (seen.size > 400) {
		const keep = new Set(anims.keys());
		for (const ev of list) if (ev && ev.id) keep.add(ev.id);
		seen.clear();
		for (const id of keep) seen.add(id);
	}
}


// ---------- rendering ----------

function resize() {
	if (!canvas.value || !wrapper.value) return;
	const rect = wrapper.value.getBoundingClientRect();
	cssW = Math.max(1, rect.width);
	cssH = Math.max(1, rect.height);
	dpr = Math.max(1, window.devicePixelRatio || 1);
	canvas.value.width = Math.round(cssW * dpr);
	canvas.value.height = Math.round(cssH * dpr);
	if (!ctx) ctx = canvas.value.getContext('2d');
	if (anims.size) ensureRaf();
}

function ensureRaf() {
	if (rafId == null && ctx) rafId = requestAnimationFrame(loop);
}

function loop(now) {
	rafId = null;
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, cssW, cssH);

	// farther back = drawn first: dancers lower on screen are nearer (same
	// floor for everyone, so just keep a stable order: oldest first)
	for (const a of anims.values()) {
		if (!drawAnim(a, now)) anims.delete(a.ev.id);
	}
	if (anims.size > 0) rafId = requestAnimationFrame(loop);
	else ctx.clearRect(0, 0, cssW, cssH);
}

/**
 * Draw one dancer for this frame.
 * @returns {boolean} false once it has left
 */
function drawAnim(a, now) {
	const ev = a.ev;
	const t = (now - a.origin) / 1000;
	if (t >= ev.duration) return false;
	if (t < ev.delay) return true;

	const s = props.settings || {};
	const heightPx = cssH * clamp(Number(s.danceHeight) || 35, 5, 100) / 100;
	const floorY = cssH * (1 - clamp(Number(s.danceFloor) || 0, 0, 90) / 100);
	const scale = heightPx / 100;
	const spotX = (ev.x / 100) * cssW;
	const below = cssH + heightPx * 0.25;          // feet this low = fully hidden
	const dir = ev.x < 50 ? -1 : 1;                 // toward the nearer edge

	let x = spotX, y = floorY, tilt = 0, squash = 0, flip = !!ev.flip, pivot = 0;
	let poseT = 0;
	const dance = a.dance;
	const land = ev.delay + TOSS_IN;

	if (t < land) {
		// tossed in from below: up to an apex above the spot, then down with a flip
		const u = (t - ev.delay) / TOSS_IN;
		const apex = floorY - heightPx * 0.75;
		const startX = spotX + dir * heightPx * 0.35;
		x = startX + (spotX - startX) * u;
		y = u < 0.55
			? apex + (below - apex) * Math.pow(1 - u / 0.55, 2)
			: apex + (floorY - apex) * Math.pow((u - 0.55) / 0.45, 2);
		tilt = -dir * Math.PI * 2 * easeInOut(u);
		pivot = 50;
	}
	else if (t < ev.danceStart) {
		// landed: squash, then bob while the rest of the crew lands
		const k = (t - land) / 0.25;
		squash = k < 1 ? 1 - k : 0.12 * (0.5 - 0.5 * Math.cos((t - land) * Math.PI * 4));
	}
	else if (t < ev.exitAt) {
		const dt = Math.min(t - ev.danceStart, ev.danceSecs);
		poseT = dt;
		if (dance.travel && t < ev.danceStart + ev.danceSecs) {
			// glide one loop, turn round, glide back (stays near the spot)
			const clip = dance.duration;
			const i = Math.floor(dt / clip);
			const p = (dt - i * clip) / clip;
			const back = i % 2 === 1;
			if (back) flip = !flip;
			const span = dance.travel * clip * scale * (ev.flip ? -1 : 1);
			x = spotX + span * ((back ? 1 - p : p) - 0.5);
		}
	}
	else {
		// hop off: jump up, flip, and drop out past the bottom edge
		const u = (t - ev.exitAt) / TOSS_OUT;
		const apex = floorY - heightPx * 0.55;
		x = spotX + dir * heightPx * 0.45 * u;
		y = u < 0.4
			? floorY + (apex - floorY) * (1 - Math.pow(1 - u / 0.4, 2))
			: apex + (below + heightPx - apex) * Math.pow((u - 0.4) / 0.6, 2);
		tilt = dir * Math.PI * 2 * easeInOut(u);
		pivot = 50;
	}

	samplePose(dance, poseT, a.pose);
	drawDancer(ctx, a.pose, {
		x, y, scale, flip, tilt, pivot, squash,
		shirt: a.look.outfit.shirt,
		pants: a.look.outfit.pants,
		outline: s.danceOutline == null ? 3 : clamp(Number(s.danceOutline) || 0, 0, 12),
		drawHead: (c, hx, hy, size, ang) => drawHead(c, a.look, hx, hy, size, ang),
	});
	return true;
}

function easeInOut(u) {
	const v = clamp(u, 0, 1);
	return v * v * (3 - 2 * v);
}

/**
 * The emoji head, centred at (x, y), rotated with the neck.
 */
function drawHead(c, look, x, y, size, ang) {
	c.save();
	c.translate(x, y);
	c.rotate(ang);
	if (look.img) {
		const iw = look.img.naturalWidth || look.img.width || 1;
		const ih = look.img.naturalHeight || look.img.height || 1;
		const k = size / Math.max(iw, ih);
		c.drawImage(look.img, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
	}
	else if (look.char) {
		// color emoji glyphs honor the fill alpha: keep it opaque
		c.globalAlpha = 1;
		c.fillStyle = '#000';
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.font = `${size}px ${EMOJI_FONT}`;
		c.fillText(look.char, 0, size * 0.04);
	}
	c.restore();
}

// ---------- lifecycle ----------

watch(() => props.events, (events) => ingest(events), { immediate: true, deep: false });

onMounted(() => {
	resize();
	ingest(props.events);
	if (wrapper.value && window.ResizeObserver) {
		resizeObserver = new ResizeObserver(() => resize());
		resizeObserver.observe(wrapper.value);
	}
	else {
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
	else {
		window.removeEventListener('resize', resize);
	}
	anims.clear();
});

// for tests / diagnostics: how many dancers are live and whether the loop runs
if (typeof window !== 'undefined') {
	window.__emojiDance = {
		live: () => anims.size,
		running: () => rafId != null,
		loaded: () => !!danceDocPromise,
		dancers: () => Array.from(anims.values()).map((a) => ({ id: a.ev.id, dance: a.dance.id, crew: a.ev.crew, x: a.ev.x, ...a.look.outfit })),
	};
}

</script>
<style scoped lang="scss">

	.dance-canvas-wrap {
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
	} // .dance-canvas-wrap

</style>
