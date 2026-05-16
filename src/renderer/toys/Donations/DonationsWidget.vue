<!--
	DonationsWidget.vue
	-------------------

	Pops up on screen whenever the toy publishes a `currentDono` payload.
	Plays the tier's sound once on arrival, fades / slides in, holds for the
	configured display duration (the toy clears `currentDono` on its own),
	then fades out.

	Sound playback is owned by the widget (not the toy) because audio needs
	a DOM context. We attach a watcher to `currentDono`'s id - any new dono
	with a soundUrl triggers a fresh `.play()`.
-->
<template>

	<div class="dono-wrapper">

		<transition name="dono">

			<div
				v-if="currentDono"
				:key="currentDono.id"
				class="dono-card"
				:style="cardStyle"
			>
				<!-- Tier color accent strip down the left edge. -->
				<div class="accent" :style="{ background: currentDono.tierColor }"></div>

				<!-- Tier image (optional). -->
				<div v-if="currentDono.imageUrl" class="image-slot">
					<img :src="currentDono.imageUrl" alt="" />
				</div>

				<div class="body">

					<!-- Tier label (e.g. "Tier 3" or whatever the streamer set). -->
					<div class="tier-label" :style="{ color: currentDono.tierColor }">
						{{ currentDono.label }}
						<span v-if="currentDono.bits > 0" class="bits"> • {{ currentDono.bits }} bits</span>
					</div>

					<!-- Username (optional). -->
					<div
						v-if="showUsername && currentDono.username"
						class="username"
						:style="{ color: usernameColor }"
					>
						{{ currentDono.username }}
					</div>

					<!-- Message (optional). -->
					<div
						v-if="showMessage && currentDono.message"
						class="message"
						:style="{ color: messageColor }"
					>
						{{ currentDono.message }}
					</div>

				</div>
			</div>

		</transition>

		<!-- Single hidden audio element. src changes per dono; .play() is
			 invoked from the watch on currentDono.id below. -->
		<audio ref="audioEl"></audio>

	</div>

</template>
<script setup>

// vue
import { ref, computed, watch } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// chat-toys plumbing
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';


const thisSlug = 'donations';
const widgetSlug = 'popup';
const slugify = (text) => thisSlug + '__' + text.toLowerCase();

keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);

const ready = ref(false);
const settings = useToySettings(thisSlug, 'widgetBox', emit, () => {
	ready.value = true;
});


// State from the toy.
const currentDono = socketShallowRefReadOnly(slugify('currentDono'), null);


// Tunables.
const showUsername  = computed(() => settings.value?.showUsername  ?? true);
const showMessage   = computed(() => settings.value?.showMessage   ?? true);
const usernameColor = computed(() => settings.value?.usernameColor ?? '#FFCA28');
const messageColor  = computed(() => settings.value?.messageColor  ?? '#FFFFFF');
const textSize      = computed(() => settings.value?.textSize      ?? 28);
const textShadow    = computed(() => settings.value?.textShadow    ?? true);
const bgColor       = computed(() => settings.value?.bgColor       ?? '#0F0F0F');
const bgOpacity     = computed(() => settings.value?.bgOpacity     ?? 0.92);
const borderColor   = computed(() => settings.value?.borderColor   ?? '#E62117');
const borderOpacity = computed(() => settings.value?.borderOpacity ?? 1.0);
const borderWidth   = computed(() => settings.value?.borderWidth   ?? 2);


/**
 * Convert a "#rrggbb" hex string + opacity (0..1) into an rgba() CSS color
 * so background and border can be opacity-tuned independently. Falls back
 * to the input if it doesn't look like a hex.
 *
 * @param {string} hex
 * @param {number} opacity
 * @returns {string}
 */
function hexToRgba(hex, opacity) {
	if (typeof hex !== 'string') return hex;
	const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
	if (!m) return hex;
	const v = parseInt(m[1], 16);
	const r = (v >> 16) & 0xff;
	const g = (v >> 8) & 0xff;
	const b = v & 0xff;
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}


/**
 * Inline CSS variable bag for the card. The scoped styles read these as
 * `var(--whatever)` so layout-level rules (font-size, shadow) stay in CSS.
 */
const cardStyle = computed(() => ({
	'--textSize':    textSize.value + 'px',
	'--textShadow':  textShadow.value ? '2px 2px 0 rgba(0, 0, 0, 0.6)' : 'none',
	'--bgColor':     hexToRgba(bgColor.value, bgOpacity.value),
	'--borderColor': hexToRgba(borderColor.value, borderOpacity.value),
	'--borderWidth': borderWidth.value + 'px',
}));


// ── Sound playback ──────────────────────────────────────────────────────────
const audioEl = ref(null);

/**
 * Watch the active dono. When a NEW dono appears (id changes) with a
 * soundUrl, swap the audio src and play. We key on id so re-renders of the
 * same dono don't re-trigger the sound.
 */
watch(() => currentDono.value?.id, (newId, oldId) => {
	if (!newId || newId === oldId) return;
	const url = currentDono.value?.soundUrl;
	const el = audioEl.value;
	if (!url || !el) return;
	try {
		el.src = url;
		el.currentTime = 0;
		// .play() returns a promise that may reject if the browser blocks
		// autoplay; swallow it so it doesn't bubble.
		const p = el.play();
		if (p && typeof p.catch === 'function') p.catch(() => {});
	} catch (e) {
		// Best-effort; missing or invalid sound shouldn't crash the widget.
	}
});

</script>
<style lang="scss" scoped>

	.dono-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: transparent;
		font-family: 'Rajdhani', sans-serif;
	}

	.dono-card {
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 16px 20px;
		max-width: 90%;
		max-height: 90%;

		background: var(--bgColor);
		border: var(--borderWidth) solid var(--borderColor);
		border-radius: 14px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);

		.accent {
			width: 6px;
			align-self: stretch;
			border-radius: 4px;
			flex-shrink: 0;
		}

		.image-slot {
			flex-shrink: 0;
			max-width: 40%;
			max-height: 100%;

			img {
				max-width: 100%;
				max-height: 220px;
				object-fit: contain;
				display: block;
			}
		}

		.body {
			flex: 1 1 auto;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 6px;
			overflow: hidden;
			text-shadow: var(--textShadow);

			.tier-label {
				font-size: 0.85em;
				font-weight: bold;
				letter-spacing: 1px;
				text-transform: uppercase;

				.bits {
					color: #ddd;
					font-weight: normal;
					font-size: 0.9em;
				}
			}

			.username {
				font-size: calc(var(--textSize) * 0.85);
				font-weight: bold;
			}

			.message {
				font-size: var(--textSize);
				line-height: 1.3;
				word-wrap: break-word;
				// Prevent runaway long messages from blowing out the card.
				display: -webkit-box;
				-webkit-line-clamp: 4;
				-webkit-box-orient: vertical;
				overflow: hidden;
			}
		}
	}

	// Enter/leave animation - slight slide up with fade.
	.dono-enter-active,
	.dono-leave-active {
		transition: transform 0.4s ease, opacity 0.4s ease;
	}
	.dono-enter-from {
		transform: translateY(40px) scale(0.96);
		opacity: 0;
	}
	.dono-leave-to {
		transform: translateY(-20px) scale(0.96);
		opacity: 0;
	}

</style>
