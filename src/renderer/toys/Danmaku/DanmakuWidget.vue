<!--
	DanmakuWidget.vue
	-----------------

	The NicoNico-style "bullet curtain" renderer.

	This widget owns ALL of the heavy lifting (the toy class is just a
	scheduler that forwards filtered chat onto a socket ref):

	  - keeps its own internal queue of pending comments (diffed out of the
	    rolling socket list by id, the same spirit as the Chat widget owning
	    its own render state)
	  - measures each comment's pixel width by mounting a real node off-screen
	  - derives a per-comment speed from width / duration, so every comment
	    lives on screen for the SAME duration and longer comments move faster
	  - runs the two-rule "golden formula" track-allocation math to find a
	    legal row, scanning top-down or bottom-up
	  - handles the overflow case (despawn or force-overwrite)
	  - animates the actual scroll with a GPU CSS transform transition (RTL or
	    LTR), and tears the node down once it has left the screen

	Comment nodes are created/positioned/destroyed imperatively rather than via
	a Vue v-for, because we need a synchronous measure-then-animate pass and we
	don't want per-frame reactivity churn (cf. the Tosser toy doing its own
	imperative ThreeJS rendering).
-->
<template>

	<div
		ref="rootEl"
		class="danmakuWidget"
		:class="{ demoMode: demoMode }"
		:style="{ opacity: layerOpacity }"
	>
		<!-- all comment nodes are appended here imperatively -->
		<div ref="layerEl" class="layer"></div>
	</div>

</template>
<script setup>

// vue
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

// slugs for this toy/widget
const thisSlug = 'danmaku';
const widgetSlug = 'danmaku';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
};

// set up our live-light code so the dashboard knows this widget is live
keepAliveSocket(thisSlug, widgetSlug);

// emit for box-change (consumed by the layout system)
const emit = defineEmits([
	'boxChange'
]);

// -------------------------------------------------------------------------
// Settings + live sockets
// -------------------------------------------------------------------------

// gets our settings (also flips `ready` once the socket has delivered them)
const ready = ref(false);
const socketSettingsRef = useToySettings('danmaku', 'danmakuBox', emit, () => {
	ready.value = true;
});

// the rolling list of comments published by the toy ({ id, text, createdAt })
const comments = socketShallowRefReadOnly(slugify('comments'), []);

// demo flag (true when previewing inside the dashboard layout page)
const demoMode = socketShallowRefReadOnly('demoMode', false);

// whole-layer opacity, derived from the 0-100 setting
const layerOpacity = computed(() => {
	const pct = socketSettingsRef.value?.opacity;
	return (typeof pct === 'number' ? pct : 85) / 100;
});

// -------------------------------------------------------------------------
// Engine state (all plain JS, deliberately non-reactive for perf)
// -------------------------------------------------------------------------

/** @type {HTMLElement|null} root element */
const rootEl = ref(null);

/** @type {HTMLElement|null} the layer comment nodes live in */
const layerEl = ref(null);

/**
 * Per-track scheduling memory. Index 0 is the first row in scan order. Each
 * entry remembers the most recently placed comment on that track so the
 * golden formula can decide when the track is free again.
 *
 * @type {Array<{ last: { startTime: number, width: number, speed: number } | null }>}
 */
let tracks = [];

/**
 * Internal pending queue. Comments sit here (already measured, node already
 * created off-screen) until the engine finds them a legal track or the hold
 * window expires and the overflow policy kicks in.
 *
 * @type {Array<{ node: HTMLElement, width: number, enqueuedAt: number }>}
 */
let queue = [];

/** rAF handle for the pump loop. */
let rafHandle = 0;

/** Highest comment id we've already consumed (avoids replaying the backlog). */
let lastSeenId = -1;

/** Live count of comment nodes on screen (for the maxOnScreen perf cap). */
let onScreenCount = 0;

/** How long (seconds) a comment may wait for a free track before overflow. */
const HOLD_SECONDS = 1.5;

/** Multiplier from font size to track (row) height. */
const TRACK_LINE_HEIGHT = 1.35;

// -------------------------------------------------------------------------
// Config helper
// -------------------------------------------------------------------------

/**
 * Snapshot the current settings into a plain object with sane fallbacks.
 * Read fresh on every pump so live setting edits take effect immediately.
 *
 * @returns {Object}
 */
function readConfig() {
	const s = socketSettingsRef.value || {};
	return {
		duration: typeof s.displayDuration === 'number' ? s.displayDuration : 5,
		direction: s.direction === 'ltr' ? 'ltr' : 'rtl',
		stackFromTop: s.stackFromTop !== false,
		coverage: typeof s.screenCoverage === 'number' ? s.screenCoverage : 60,
		overflowMode: s.overflowMode === 'overwrite' ? 'overwrite' : 'despawn',
		maxOnScreen: typeof s.maxOnScreen === 'number' ? s.maxOnScreen : 60,
		fontFamily: s.fontFamily || "'Open Sans', sans-serif",
		fontSize: typeof s.fontSize === 'number' ? s.fontSize : 32,
		fontColor: s.fontColor || '#FFFFFF',
		fontOutline: s.fontOutline !== false,
	};
}

// -------------------------------------------------------------------------
// Node creation + measurement
// -------------------------------------------------------------------------

/**
 * Eight-direction text-shadow that fakes a solid outline for readability.
 *
 * @param {number} size - font size px (outline scales a touch with it)
 * @returns {string}
 */
function outlineShadow(size) {
	const o = Math.max(1, Math.round(size / 16));
	return [
		`-${o}px -${o}px 0 #000`, `${o}px -${o}px 0 #000`,
		`-${o}px ${o}px 0 #000`, `${o}px ${o}px 0 #000`,
		`0 ${o}px 0 #000`, `0 -${o}px 0 #000`,
		`${o}px 0 0 #000`, `-${o}px 0 0 #000`,
	].join(', ');
}

/**
 * Fill a comment node with its content, swapping custom-emoji codes ("&code;")
 * for <img> tags. Emoji images are sized to a fixed square (~font size) so the
 * node's measured width is deterministic immediately, without waiting on image
 * loads - important because the collision math keys off that width. Plain text
 * (including unicode emoji glyphs) is appended as text nodes.
 *
 * @param {HTMLElement} node - the comment node to fill
 * @param {string} text - raw message text with embedded "&code;" emoji codes
 * @param {Array<{code: string, url: string}>} emojis - custom-emoji lookup
 * @param {Object} cfg - config snapshot from readConfig()
 */
function fillNodeContent(node, text, emojis, cfg) {

	// O(1) code -> url lookup
	const map = new Map();
	if (Array.isArray(emojis)) {
		for (const e of emojis) {
			if (e && e.code)
				map.set(e.code, e.url);
		}
	}

	// split on "&code;" tokens (same pattern the Chat widget's ParsedMessage uses)
	const parts = text.split(/(&[a-zA-Z0-9_\-:]+;)/g);

	for (const part of parts) {

		if (part === '')
			continue;

		// custom emoji?
		if (part.length > 2 && part.startsWith('&') && part.endsWith(';')) {
			const code = part.slice(1, -1);
			const url = map.get(code);
			if (url) {
				const img = document.createElement('img');
				img.className = 'danmakuEmoji';
				img.src = url;
				img.alt = code;
				img.style.height = cfg.fontSize + 'px';
				img.style.width = cfg.fontSize + 'px';
				img.style.objectFit = 'contain';
				img.style.verticalAlign = 'middle';
				img.style.margin = '0 2px';
				node.appendChild(img);
				continue;
			}
			// unknown code: fall through and render it as literal text
		}

		// plain text (danmaku is single-line, so collapse any newlines)
		node.appendChild(document.createTextNode(part.replace(/\n/g, ' ')));
	}
}

/**
 * Create a comment node, style it, mount it off-screen, and measure its
 * width. The node is left parked off-screen until place() animates it.
 *
 * @param {string} text - comment text
 * @param {Array<{code: string, url: string}>} emojis - custom-emoji lookup
 * @param {Object} cfg - config snapshot from readConfig()
 * @returns {{ node: HTMLElement, width: number } | null}
 */
function buildNode(text, emojis, cfg) {

	const layer = layerEl.value;
	if (!layer)
		return null;

	const node = document.createElement('div');
	node.className = 'danmakuComment';
	fillNodeContent(node, text, emojis, cfg);

	// text styling from settings
	node.style.position = 'absolute';
	node.style.top = '-9999px';            // parked off-screen for measuring
	node.style.left = '0';
	node.style.whiteSpace = 'nowrap';
	node.style.fontFamily = cfg.fontFamily;
	node.style.fontSize = cfg.fontSize + 'px';
	node.style.lineHeight = (cfg.fontSize * TRACK_LINE_HEIGHT) + 'px';
	node.style.fontWeight = 'bold';
	node.style.color = cfg.fontColor;
	node.style.willChange = 'transform';
	node.style.textShadow = cfg.fontOutline ? outlineShadow(cfg.fontSize) : 'none';

	layer.appendChild(node);

	// synchronous layout read -> measured width
	const width = node.offsetWidth;

	return { node, width };
}

// -------------------------------------------------------------------------
// Track allocation (the "golden formula")
// -------------------------------------------------------------------------

/**
 * Whether `track` is legal for a new comment of speed vB right now.
 *
 * Rule 1 (tail clearance): the previous comment A must have fully entered:
 *   t_now >= startA + wA / vA
 * Rule 2 (catch-up): a faster B must not rear-end A before A exits:
 *   t_now >= startA + (D - W / vB)
 * Combined:
 *   t_now >= startA + max(wA / vA, D - W / vB)
 *
 * @param {{ last: Object|null }} track
 * @param {number} now - seconds
 * @param {number} vB - speed of the incoming comment (px/s)
 * @param {number} W - screen (layer) width px
 * @param {number} D - display duration seconds
 * @returns {boolean}
 */
function trackAvailable(track, now, vB, W, D) {

	if (!track.last)
		return true;

	const { startTime: tA, width: wA, speed: vA } = track.last;
	const clearance = Math.max(wA / vA, D - W / vB);
	return now >= tA + clearance;
}

/**
 * Index of the track whose last comment started longest ago (for the
 * force-overwrite overflow mode). Falls back to 0.
 *
 * @returns {number}
 */
function oldestTrackIndex() {
	let idx = 0;
	let oldest = Infinity;
	for (let i = 0; i < tracks.length; i++) {
		const start = tracks[i].last ? tracks[i].last.startTime : -Infinity;
		if (start < oldest) {
			oldest = start;
			idx = i;
		}
	}
	return idx;
}

/**
 * Resize the `tracks` array to `count`, preserving existing scheduling
 * memory where possible.
 *
 * @param {number} count
 */
function ensureTrackCount(count) {
	if (tracks.length === count)
		return;
	if (count < tracks.length) {
		tracks.length = count;
	} else {
		while (tracks.length < count)
			tracks.push({ last: null });
	}
}

// -------------------------------------------------------------------------
// Placement + animation
// -------------------------------------------------------------------------

/**
 * Animate a measured comment across `trackIdx` and schedule its teardown.
 *
 * @param {{ node: HTMLElement, width: number }} item
 * @param {number} trackIdx
 * @param {number} vB - speed px/s (recorded into the track)
 * @param {number} now - seconds
 * @param {Object} cfg
 * @param {number} W - layer width px
 * @param {number} H - layer height px
 */
function place(item, trackIdx, vB, now, cfg, W, H) {

	const node = item.node;
	const trackHeight = cfg.fontSize * TRACK_LINE_HEIGHT;

	// vertical position depends on stack direction
	const top = cfg.stackFromTop
		? (trackIdx * trackHeight)
		: (H - (trackIdx + 1) * trackHeight);
	node.style.top = top + 'px';

	// record this placement so the next comment's formula can see it
	tracks[trackIdx].last = { startTime: now, width: item.width, speed: vB };

	// start / end x depend on scroll direction
	const startX = cfg.direction === 'ltr' ? -item.width : W;
	const endX = cfg.direction === 'ltr' ? W : -item.width;

	// Park at the start position first (translate3d -> own GPU layer) so the
	// node never flashes at x=0 on the frame before the animation begins.
	node.style.transform = `translate3d(${startX}px, 0, 0)`;

	// Drive the scroll with the Web Animations API rather than a CSS
	// transition. WAA runs on the compositor and - crucially - needs no
	// forced-reflow "reset" hack (the old `void node.offsetWidth`), which was
	// the main source of jank: every spawn forced a synchronous layout of all
	// on-screen comments. `fill: 'forwards'` leaves the node resting off-screen
	// if teardown is ever delayed.
	const anim = node.animate(
		[
			{ transform: `translate3d(${startX}px, 0, 0)` },
			{ transform: `translate3d(${endX}px, 0, 0)` },
		],
		{ duration: cfg.duration * 1000, easing: 'linear', fill: 'forwards' }
	);

	onScreenCount++;

	// tear the node down the instant it has finished crossing
	anim.onfinish = () => removeNode(node);

	// keep a handle so unmount can cancel cleanly
	node.__danAnim = anim;
}

/**
 * Remove a comment node and decrement the on-screen counter.
 *
 * @param {HTMLElement} node
 */
function removeNode(node) {
	if (node && node.parentNode) {
		node.parentNode.removeChild(node);
		onScreenCount = Math.max(0, onScreenCount - 1);
	}
}

// -------------------------------------------------------------------------
// Queue intake + pump loop
// -------------------------------------------------------------------------

/**
 * Build + measure a comment node and add it to the internal pending queue.
 *
 * @param {string} text
 * @param {Array<{code: string, url: string}>} [emojis] - custom-emoji lookup
 */
function enqueueComment(text, emojis) {

	if (!text || !layerEl.value)
		return;

	const cfg = readConfig();
	const built = buildNode(text, emojis, cfg);
	if (!built)
		return;

	queue.push({
		node: built.node,
		width: built.width,
		enqueuedAt: performance.now() / 1000,
	});
}

/**
 * The rAF pump. Tries to place every queued comment onto a legal track;
 * items with no legal track wait up to HOLD_SECONDS, then the overflow
 * policy resolves them.
 */
function pump() {

	rafHandle = window.requestAnimationFrame(pump);

	if (!queue.length || !layerEl.value)
		return;

	const cfg = readConfig();
	const rect = layerEl.value.getBoundingClientRect();
	const W = rect.width || 1280;
	const H = rect.height || 720;
	const D = cfg.duration > 0 ? cfg.duration : 5;
	const now = performance.now() / 1000;

	// recompute how many rows fit given coverage + font size
	const trackHeight = cfg.fontSize * TRACK_LINE_HEIGHT;
	const usableH = H * (cfg.coverage / 100);
	const trackCount = Math.max(1, Math.floor(usableH / trackHeight));
	ensureTrackCount(trackCount);

	// Scan tracks in index order (0..n-1). The track INDEX is what maps to a
	// screen row - place() converts index -> top using stackFromTop, so the
	// first-available index naturally fills from the top or the bottom edge.
	const survivors = [];

	for (const item of queue) {

		// perf cap: treat as overflow-despawn when too many are on screen
		if (onScreenCount >= cfg.maxOnScreen) {
			removeNode(item.node);
			continue;
		}

		const vB = (W + item.width) / D;

		// find first legal track (lowest index = top or bottom edge per cfg)
		let chosen = -1;
		for (let idx = 0; idx < trackCount; idx++) {
			if (trackAvailable(tracks[idx], now, vB, W, D)) {
				chosen = idx;
				break;
			}
		}

		// no legal track -> wait, then apply overflow policy
		if (chosen === -1) {
			const waited = now - item.enqueuedAt;
			if (waited < HOLD_SECONDS) {
				survivors.push(item);
				continue;
			}
			if (cfg.overflowMode === 'despawn') {
				removeNode(item.node);
				continue;
			}
			// overwrite: slam it onto the oldest track
			chosen = oldestTrackIndex();
		}

		place(item, chosen, vB, now, cfg, W, H);

	}// next queued item

	queue = survivors;
}

// -------------------------------------------------------------------------
// Wiring: socket intake + demo mode
// -------------------------------------------------------------------------

// pull newly-arrived comments off the rolling socket list
watch(comments, (list) => {

	if (!Array.isArray(list) || !list.length)
		return;

	// first delivery: jump our cursor to the newest id so we don't replay
	// the whole backlog the instant the widget loads
	if (lastSeenId === -1) {
		lastSeenId = list[list.length - 1].id;
		return;
	}

	for (const c of list) {
		if (c && c.id > lastSeenId) {
			lastSeenId = c.id;
			enqueueComment(c.text, c.emojis);
		}
	}

}, { deep: false });

// demo comments for the dashboard layout preview
let demoTimer = 0;
const DEMO_LINES = [
	'lol', 'POG', 'this is so cool', 'wwwww', '888888',
	'first!', 'cute model :3', 'where is this from?', 'banger song',
	'agree 100%', 'no wayyy', 'haha nice', 'GG', 'hello from chat',
];
watch(demoMode, (on) => {
	if (on) {
		demoTimer = window.setInterval(() => {
			const line = DEMO_LINES[Math.floor(Math.random() * DEMO_LINES.length)];
			enqueueComment(line);
		}, 600);
	} else {
		if (demoTimer)
			window.clearInterval(demoTimer);
		demoTimer = 0;
	}
}, { immediate: true });

// -------------------------------------------------------------------------
// Lifecycle
// -------------------------------------------------------------------------

onMounted(() => {
	rafHandle = window.requestAnimationFrame(pump);
});

onBeforeUnmount(() => {

	// stop the pump
	if (rafHandle)
		window.cancelAnimationFrame(rafHandle);

	// stop demo
	if (demoTimer)
		window.clearInterval(demoTimer);

	// cancel any in-flight scroll animations + drop their nodes
	if (layerEl.value) {
		const nodes = layerEl.value.querySelectorAll('.danmakuComment');
		for (const n of nodes) {
			if (n.__danAnim)
				n.__danAnim.cancel();
		}
	}

	// drop any still-queued (un-placed) nodes
	for (const item of queue)
		removeNode(item.node);
	queue = [];

	if (layerEl.value)
		layerEl.value.innerHTML = '';
});

</script>
<style lang="scss" scoped>

	// fills its layout box
	.danmakuWidget {

		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		pointer-events: none;

		// dashed frame only while previewing in the dashboard
		&.demoMode {
			border: 1px dashed rgba(255, 255, 255, 0.5);
		}

		.layer {
			position: absolute;
			inset: 0;
		}

		// imperatively-created nodes aren't scoped-hashed, so target them
		// loosely via :deep for the few shared rules we need.
		:deep(.danmakuComment) {
			user-select: none;
		}

	}// .danmakuWidget

</style>
