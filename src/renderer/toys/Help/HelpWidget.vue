<!--
	HelpWidget.vue
	--------------

	Renders the tip card published by the Help toy. Responsive - fills 100%
	of whatever OBS browser-source dimensions the streamer picks, with the
	tip card pinned to one edge (per `slideDirection`) and animated in / out
	via CSS transform transitions.

	No physics, no timer; the toy class owns the rotation logic. The widget
	just reflects state.
-->
<template>

	<div class="help-wrapper">

		<transition :name="transitionName">

			<div
				v-if="currentTip"
				:key="currentTip.id"
				class="tip-card"
				:class="`slide-${slideDir}`"
				:style="cardStyle"
			>
				<!-- Accent strip uses the source toy's themeColor so the
					 streamer can tell at-a-glance which toy the tip is for. -->
				<div class="accent" :style="{ background: currentTip.toyColor }"></div>

				<div class="body">
					<div class="header">
						<span class="emoji">💡</span>
						<span class="toy-name" :style="{ color: currentTip.toyColor }">
							{{ currentTip.toyName }}
						</span>
					</div>
					<div class="text">{{ currentTip.tipText }}</div>
				</div>
			</div>

		</transition>

	</div>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// chat-toys plumbing
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';


// ── plumbing ────────────────────────────────────────────────────────────────
const thisSlug = 'help';
const widgetSlug = 'tipCard';
const slugify = (text) => thisSlug + '__' + text.toLowerCase();

// Heartbeat to the main app.
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);

// useToySettings flips ready once the settings socket lands.
const ready = ref(false);
const settings = useToySettings(thisSlug, 'widgetBox', emit, () => {
	ready.value = true;
});


// ── state pulled from the toy ───────────────────────────────────────────────
const currentTip = socketShallowRefReadOnly(slugify('currentTip'), null);


// ── tunables (with safe defaults so the widget renders sensibly before
//    settings load) ─────────────────────────────────────────────────────────
const slideDir       = computed(() => settings.value?.slideDirection ?? 'bottom');
const bgColor        = computed(() => settings.value?.bgColor       ?? '#000000');
const bgOpacity      = computed(() => settings.value?.bgOpacity     ?? 0.85);
const borderColor    = computed(() => settings.value?.borderColor   ?? '#FFCA28');
const borderOpacity  = computed(() => settings.value?.borderOpacity ?? 1.0);
const borderWidth    = computed(() => settings.value?.borderWidth   ?? 2);
const textColor      = computed(() => settings.value?.textColor     ?? '#FFFFFF');
const textSize       = computed(() => settings.value?.textSize      ?? 22);
const textShadow     = computed(() => settings.value?.textShadow    ?? true);


/**
 * Map slide direction to a Vue <transition> name so the matching CSS
 * enter/leave classes pick up the right transform axis + sign.
 */
const transitionName = computed(() => `slide-${slideDir.value}`);


/**
 * Inline CSS variables + styles that depend on settings. Pushed through
 * --vars so the scoped CSS can compose rgba() with the opacity values.
 */
const cardStyle = computed(() => {
	return {
		'--bgColor':       hexToRgba(bgColor.value, bgOpacity.value),
		'--borderColor':   hexToRgba(borderColor.value, borderOpacity.value),
		'--borderWidth':   borderWidth.value + 'px',
		'--textColor':     textColor.value,
		'--textSize':      textSize.value + 'px',
		'--textShadow':    textShadow.value
			? '2px 2px 0 rgba(0, 0, 0, 0.6)'
			: 'none',
	};
});


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

</script>
<style lang="scss" scoped>

	// Fills the OBS browser source; positions the tip card relative to the
	// configured edge.
	.help-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: transparent;
		pointer-events: none;
		font-family: 'Rajdhani', sans-serif;
	}

	// The tip card itself. Default sizing leaves a comfortable margin from
	// the edge and lets the card auto-size to its text on the cross-axis.
	.tip-card {
		position: absolute;
		display: flex;
		gap: 12px;
		padding: 14px 18px;
		background: var(--bgColor);
		border: var(--borderWidth) solid var(--borderColor);
		border-radius: 12px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);

		// `slide-*` modifier classes pin the card to the matching edge and
		// determine which axis the slide animation travels along.
		&.slide-top {
			top: 20px;
			left: 20px;
			right: 20px;
		}
		&.slide-bottom {
			bottom: 20px;
			left: 20px;
			right: 20px;
		}
		&.slide-left {
			top: 20px;
			bottom: 20px;
			left: 20px;
			max-width: 40%;
		}
		&.slide-right {
			top: 20px;
			bottom: 20px;
			right: 20px;
			max-width: 40%;
		}

		.accent {
			width: 5px;
			align-self: stretch;
			border-radius: 4px;
			flex-shrink: 0;
		}

		.body {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 6px;
			color: var(--textColor);
			text-shadow: var(--textShadow);

			.header {
				display: flex;
				align-items: center;
				gap: 8px;

				.emoji {
					font-size: 1.2em;
				}

				.toy-name {
					font-weight: bold;
					font-size: 1em;
					letter-spacing: 0.5px;
					text-transform: uppercase;
				}
			}

			.text {
				font-size: var(--textSize);
				line-height: 1.35;
				word-wrap: break-word;
			}
		}
	}

	// ── Slide transitions ───────────────────────────────────────────────────
	// One Vue <transition> name per direction. enter-from / leave-to use
	// translate transforms that move the card off-screen in the appropriate
	// direction; the resting position is `transform: none`.

	.slide-top-enter-active,
	.slide-top-leave-active,
	.slide-bottom-enter-active,
	.slide-bottom-leave-active,
	.slide-left-enter-active,
	.slide-left-leave-active,
	.slide-right-enter-active,
	.slide-right-leave-active {
		transition: transform 0.5s ease, opacity 0.5s ease;
	}

	.slide-top-enter-from,
	.slide-top-leave-to {
		transform: translateY(-150%);
		opacity: 0;
	}
	.slide-bottom-enter-from,
	.slide-bottom-leave-to {
		transform: translateY(150%);
		opacity: 0;
	}
	.slide-left-enter-from,
	.slide-left-leave-to {
		transform: translateX(-150%);
		opacity: 0;
	}
	.slide-right-enter-from,
	.slide-right-leave-to {
		transform: translateX(150%);
		opacity: 0;
	}

</style>
