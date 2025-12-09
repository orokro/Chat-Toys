<!--
	EmojiFountainWidget.vue
	-----------------------

	The widget that displays the emoji fountain/rain particles.
-->
<template>

	<div
		v-if="ready"
		class="emojiFountainWidget"
		:style="widgetStyle"
	>

		<!-- Particles -->
		<div
            v-for="p in renderParticles"
            :key="p.id"
            class="ef-particle"
            :style="p.outerStyle"
        >
			<div class="ef-scale" :style="p.scaleStyle">
				<div class="ef-spin" :style="p.spinStyle">
					<img class="ef-emoji" :src="p.src" alt="" />
				</div>
			</div>
		</div>
	</div>

</template>
<script setup>

// vue
import {
	ref,
	computed,
	shallowRef,
	watch,
	onMounted,
	onBeforeUnmount
} from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

// emoji cache helper
import { getEmojiSource } from '../emojiCache.js';

const thisSlug = 'emojiFountain';
const widgetSlug = 'emojiFountainWidget';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
};

// keep socket alive so OBS widgets stay connected
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits([
	'boxChange'
]);

defineProps({});

// ---------- Settings / state ----------

const ready = ref(false);
const socketSettingsRef = useToySettings('emojiFountain', 'emojiFountainBox', emit, () => {
	ready.value = true;
});

// global app-wide demo mode
const demoMode = socketShallowRefReadOnly('demoMode', false);

// particles from Toy
const socketParticles = socketShallowRefReadOnly(slugify('particles'), []);

// local map url -> src (raw or blob)
const sources = shallowRef(new Map());

// ---------- Emoji source handling (cache aware) ----------

function ensureSrcForUrl(url, useCache) {
	if (!url) return;

	const map = sources.value;
	if (map.has(url)) return;

	// not caching: just use the raw URL
	if (!useCache) {
		const next = new Map(map);
		next.set(url, url);
		sources.value = next;
		return;
	}

	// caching via emojiCache.js
	getEmojiSource(url)
		.then(({ src }) => {
			const next = new Map(sources.value);
			next.set(url, src);
			sources.value = next;
		})
		.catch(() => {
			const next = new Map(sources.value);
			next.set(url, url);
			sources.value = next;
		});
}

// ---------- Demo particles ----------

const DEMO_EMOJI_URLS = [
	'https://twemoji.maxcdn.com/v/latest/72x72/1f389.png', // 🎉
	'https://twemoji.maxcdn.com/v/latest/72x72/1f602.png', // 😂
	'https://twemoji.maxcdn.com/v/latest/72x72/2764.png'   // ❤️
];

const demoParticles = ref([]);

function randomRange(min, max) {
	return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
	return v < min ? min : v > max ? max : v;
}

function safeSpeedFromSettings() {
	const s = socketSettingsRef.value?.speed;
	return (s && s > 0) ? s : 1.0;
}

function nextDemoId(index) {
	return `demo_${index}_${Date.now()}`;
}

function buildDemoRainParticle(url, speed, scale, index) {
	const startYNorm = -0.2;
	const endYNorm = 1.1;
	const distance = endYNorm - startYNorm;
	const baseTime = 1.3;
	let duration = baseTime * Math.sqrt(distance);

	const bounces = Math.random() < 0.5 ? 1 : 2;
	const bounceExtra = bounces * 0.25;
	duration += bounceExtra;
	duration = duration / speed;

	const startX = Math.random() * 100;
	const endX = clamp(startX + randomRange(-15, 15), 0, 100);

	return {
		id: nextDemoId(index),
		url,
		type: 'rain',
		duration,
		delay: randomRange(0, 1.5),

		startX,
		endX,
		apexX: (startX + endX) / 2,

		startY: startYNorm * 100,
		apexY: 100,
		endY: endYNorm * 100,

		bounces,
		spinSpeed: randomRange(60, 180) * (Math.random() < 0.5 ? -1 : 1),
		scale
	};
}

function buildDemoTossParticle(url, speed, scale, index) {
	const startYNorm = 1.05;
	const endYNorm = 1.15;
	const apexYNorm = randomRange(0.1, 0.5);

	const upDistance = startYNorm - apexYNorm;
	const downDistance = endYNorm - apexYNorm;
	const distance = upDistance + downDistance;

	const baseTime = 1.2;
	let duration = baseTime * Math.sqrt(distance);
	duration = duration / speed;

	const startX = Math.random() * 100;
	const endX = clamp(startX + randomRange(-25, 25), 0, 100);
	const apexX = clamp((startX + endX) / 2 + randomRange(-10, 10), 0, 100);

	return {
		id: nextDemoId(index),
		url,
		type: 'toss',
		duration,
		delay: randomRange(0, 1.0),

		startX,
		endX,
		apexX,

		startY: startYNorm * 100,
		apexY: apexYNorm * 100,
		endY: endYNorm * 100,

		bounces: 0,
		spinSpeed: randomRange(120, 360) * (Math.random() < 0.5 ? -1 : 1),
		scale
	};
}

function rebuildDemoParticles() {
	const mode = socketSettingsRef.value?.mode === 'rain' ? 'rain' : 'toss';
	const speed = safeSpeedFromSettings();
	const scale = socketSettingsRef.value?.emojiSize ?? 1.0;

	const items = [];
	const total = 16;

	for (let i = 0; i < total; i++) {
		const url = DEMO_EMOJI_URLS[i % DEMO_EMOJI_URLS.length];
		if (mode === 'rain') {
			items.push(buildDemoRainParticle(url, speed, scale, i));
		} else {
			items.push(buildDemoTossParticle(url, speed, scale, i));
		}
	}

	demoParticles.value = items;
}

// rebuild demo whenever demoMode toggles on or mode changes
watch(
	() => ({
		demo: demoMode.value,
		mode: socketSettingsRef.value?.mode
	}),
	({ demo }) => {
		if (demo) {
			rebuildDemoParticles();
		}
	},
	{ immediate: true }
);

// ---------- Pick which particle set to render ----------

const particlesForRender = computed(() => {
	if (demoMode.value) {
		return demoParticles.value || [];
	}
	return socketParticles.value || [];
});

// kick off emoji src resolution whenever particles or cache setting change
watch(
	() => ({
		particles: particlesForRender.value,
		useCache: socketSettingsRef.value?.cacheEmojiImages
	}),
	({ particles, useCache }) => {
		if (!particles) return;
		for (const p of particles) {
			if (!p || !p.url) continue;
			ensureSrcForUrl(p.url, !!useCache);
		}
	},
	{ immediate: true, deep: false }
);

// ---------- Keyframe + style builders ----------


function lerp(a, b, t) {
	return a + (b - a) * t;
}

function quadBezier(p0, p1, p2, t) {
	const omt = 1 - t;
	return omt * omt * p0 + 2 * omt * t * p1 + t * t * p2;
}

function buildMotionKeyframes(p, name, loop) {
	const sx = p.startX ?? 50;
	const ex = p.endX ?? sx;
	const ax = p.apexX ?? ((sx + ex) / 2);

	const sy = p.startY ?? 100;
	const ey = p.endY ?? 120;
	const ay = p.apexY ?? 50;

	const steps = 24; // more steps = smoother motion
	let css = `@keyframes ${name} {\n`;

	if (p.type === 'rain') {

		// Piecewise gravity + bounce:
		// tHit: first hit bottom, tPeak: bounce peak, tEnd: off-screen
		const tHit = 0.7;
		const tPeak = 0.85;
		const tEnd = 1.0;

		for (let i = 0; i <= steps; i++) {
            // normalized time 0..1
			const t = i / steps;

			let x, y;

			// Horizontal: gentle drift from sx -> ex
			x = lerp(sx, ex, t);

			if (t <= tHit) {
				// Freefall sy -> 100 (accelerating)
				const tau = t / tHit;
				// quadratic towards bottom
				y = quadBezier(sy, sy, 100, tau);
			} else if (t <= tPeak) {
				// Bounce up then back to bottom (100 -> 90 -> 100)
				const tau = (t - tHit) / (tPeak - tHit);
				y = quadBezier(100, 90, 100, tau);
			} else {
				// Final fall off-screen: 100 -> ey, gentle (no weird rocket)
				const tau = (t - tPeak) / (tEnd - tPeak);
				y = quadBezier(100, 100, ey, tau);
			}

			const pct = (t * 100).toFixed(1).replace(/\.0$/, '');
			css += `\t${pct}% {\n\t\tleft: ${x}%;\n\t\ttop: ${y}%;\n\t}\n`;
		}

		css += '}\n';
		return css;
	}

	if (p.type === 'fountain') {
		// Nice parabolic fountain with a softer landing (no triangle),
		// no hard “zoom” after bounce. We'll approximate:
		//   start -> apex -> near bottom (98%) as one big arc.

		const endYForArc = 98; // hit just above "ground"
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;

			// Quadratic Bézier from start -> apex -> near bottom
			const x = quadBezier(sx, ax, ex, t);
			const y = quadBezier(sy, ay, endYForArc, t);

			const pct = (t * 100).toFixed(1).replace(/\.0$/, '');
			css += `\t${pct}% {\n\t\tleft: ${x}%;\n\t\ttop: ${y}%;\n\t}\n`;
		}

		css += '}\n';
		return css;
	}

	// Default: toss
	// Pure arc: start -> apex -> end with quadratic Bézier.
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;

		const x = quadBezier(sx, ax, ex, t);
		const y = quadBezier(sy, ay, ey, t);

		const pct = (t * 100).toFixed(1).replace(/\.0$/, '');
		css += `\t${pct}% {\n\t\tleft: ${x}%;\n\t\ttop: ${y}%;\n\t}\n`;
	}

	css += '}\n';
	return css;
}


function buildSpinKeyframes(p, name) {
	const angle = (p.spinSpeed || 0) * (p.duration || 1);
	return `
@keyframes ${name} {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(${angle}deg);
	}
}
`;
}

// ---------- Final render particles (with styles + keyframes) ----------

const renderParticles = computed(() => {
	const items = particlesForRender.value || [];
	const s = socketSettingsRef.value || {};
	const scaleSetting = s.emojiSize != null ? s.emojiSize : 1.0;

	const map = sources.value;
	const isDemo = demoMode.value;

	return items
		.filter((p) => !!p && !!p.url)
		.map((p, idx) => {
			const id = p.id || `ef_${idx}`;
			const motionName = `ef_motion_${id}`;
			const spinName = `ef_spin_${id}`;
			const duration = Number(p.duration || 1);
			const delay = Number(p.delay || 0);
			const loop = !!isDemo; // demo mode loops animations

			const src = map.get(p.url) || p.url;

			const motionKeyframes = buildMotionKeyframes(p, motionName, loop);
			const spinKeyframes = buildSpinKeyframes(p, spinName);

			const outerStyle = {
				position: 'absolute',
				pointerEvents: 'none',
				animationName: motionName,
				animationDuration: `${duration}s`,
				animationDelay: `${delay}s`,
				animationTimingFunction: 'linear',
				animationFillMode: loop ? 'none' : 'forwards',
				animationIterationCount: loop ? 'infinite' : '1'
			};


			const scaleStyle = {
				transform: `translate(-50%, -50%) scale(${(p.scale || 1) * scaleSetting})`
			};

			const spinStyle = {
				animationName: spinName,
				animationDuration: `${duration}s`,
				animationDelay: `${delay}s`,
				animationTimingFunction: 'linear',
				animationFillMode: loop ? 'none' : 'forwards',
				animationIterationCount: loop ? 'infinite' : '1'
			};

			return {
				id,
				src,
				motionKeyframes,
				spinKeyframes,
				outerStyle,
				scaleStyle,
				spinStyle
			};
		});
});

// ---------- Inject dynamic keyframes into <head> ----------

const dynamicStyleEl = ref(null);

function applyDynamicCSS() {
	if (!dynamicStyleEl.value) return;
	const css = renderParticles.value
		.map((p) => (p.motionKeyframes || '') + (p.spinKeyframes || ''))
		.join('\n');
	dynamicStyleEl.value.textContent = css;
}

onMounted(() => {
	if (typeof document === 'undefined') return;
	const el = document.createElement('style');
	el.id = 'emoji-fountain-dynamic';
	document.head.appendChild(el);
	dynamicStyleEl.value = el;
	applyDynamicCSS();
});

onBeforeUnmount(() => {
	if (dynamicStyleEl.value && dynamicStyleEl.value.parentNode) {
		dynamicStyleEl.value.parentNode.removeChild(dynamicStyleEl.value);
	}
	dynamicStyleEl.value = null;
});

// whenever renderParticles changes, update the CSS
watch(renderParticles, () => {
	applyDynamicCSS();
});

// ---------- Widget style ----------

const widgetStyle = computed(() => {
	return {
		width: '100%',
		height: '100%',
		position: 'relative',
		overflow: 'clip'
	};
});

</script>
<style scoped lang="scss">

	.emojiFountainWidget {
		width: 100%;
		height: 100%;
		position: relative;
		overflow: clip;
		pointer-events: none;
	} // .emojiFountainWidget

	.ef-particle {
		position: absolute;

	}// .ef-particle

	.ef-scale {
		position: absolute;
		left: 0;
		top: 0;

	}// .ef-scale

	.ef-spin {
	}

	.ef-emoji {
		display: block;
		width: 48px;
		height: 48px;
	}// .ef-emoji

</style>
