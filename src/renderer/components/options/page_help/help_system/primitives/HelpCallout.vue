<!--
	HelpCallout.vue
	---------------

	Internal base for the four named callouts (Tip / Warning / Trouble /
	Example). Provides the shared chrome - left-rail icon column, header
	bar with kind-specific color and label, body area. The named
	callouts are skin-thin wrappers around this that hard-code the
	kind so authors don't have to remember the kebab strings.

	Author-facing API is the named wrappers. This file should not be
	imported directly from topic files - use HelpTip / HelpWarning /
	HelpTrouble / HelpExample instead.
-->
<template>

	<aside
		class="helpCallout"
		:class="`kind-${kind}`"
		role="note"
	>

		<header class="calloutHeader">
			<span class="material-icons calloutIcon">{{ iconName }}</span>
			<span class="calloutLabel">{{ resolvedLabel }}</span>
		</header>

		<div class="calloutBody">
			<slot />
		</div>

	</aside>

</template>
<script setup>

// vue
import { computed } from 'vue';


// props
const props = defineProps({

	/**
	 * Which named callout this is. Drives color, default icon, and
	 * default label. The named wrapper components set this for you.
	 */
	kind: {
		type: String,
		required: true,
		validator: (v) => ['tip', 'warning', 'trouble', 'example'].includes(v),
	},

	/**
	 * Optional override for the header label. Defaults to a sensible
	 * per-kind word ("Tip", "Heads up", "Troubleshooting", "Example").
	 */
	label: {
		type: String,
		default: null,
	},

	/**
	 * Optional override for the material-icon glyph. Defaults to a
	 * sensible per-kind icon.
	 */
	icon: {
		type: String,
		default: null,
	},

});


// per-kind defaults
const KIND_DEFAULTS = {
	tip:      { label: 'Tip',             icon: 'lightbulb' },
	warning:  { label: 'Heads up',        icon: 'warning' },
	trouble:  { label: 'Troubleshooting', icon: 'build' },
	example:  { label: 'Example',         icon: 'play_circle' },
};


/**
 * Resolve the header label, preferring the user-supplied override.
 *
 * @returns {string}
 */
const resolvedLabel = computed(() => props.label || KIND_DEFAULTS[props.kind]?.label || 'Note');


/**
 * Resolve the icon glyph, preferring the user-supplied override.
 *
 * @returns {string}
 */
const iconName = computed(() => props.icon || KIND_DEFAULTS[props.kind]?.icon || 'info');

</script>
<style lang="scss" scoped>

	// shared chrome - book-style boxed callouts with a colored band
	// across the top. Kind-specific colors are applied via the
	// .kind-* class selectors below.
	.helpCallout {

		// reset stacking
		position: relative;

		// spacing around the box
		margin: 22px 0;

		// box look
		border-radius: 8px;
		border: 1px solid var(--callout-border);
		background: var(--callout-bg);
		overflow: hidden;

		.calloutHeader {

			display: flex;
			align-items: center;
			gap: 8px;

			padding: 8px 14px;
			background: var(--callout-band);
			color: var(--callout-band-fg);

			font-weight: 600;
			font-size: 13px;
			text-transform: uppercase;
			letter-spacing: 0.6px;

			.calloutIcon {
				font-size: 18px;
			}

			.calloutLabel {
				line-height: 1;
			}

		}// .calloutHeader

		.calloutBody {

			padding: 14px 16px;
			color: #2b2b35;
			font-size: 14.5px;
			line-height: 1.55;

			// tighten the first/last paragraph so the box doesn't
			// have weird double-padding
			:deep(p) {
				margin: 0 0 10px 0;
			}
			:deep(p:last-child) {
				margin-bottom: 0;
			}

			:deep(ul), :deep(ol) {
				margin: 0 0 10px 22px;

				li {
					margin-bottom: 4px;
				}
			}

			:deep(code) {
				font-family: 'Courier New', Courier, monospace;
				font-size: 13px;
				background: rgba(0, 0, 0, 0.06);
				padding: 1px 5px;
				border-radius: 4px;
			}

		}// .calloutBody

		// ---- per-kind palettes ----

		// Tip - friendly blue/teal, the project's signature.
		&.kind-tip {
			--callout-bg:        #f1f8ff;
			--callout-border:    #b8d6f5;
			--callout-band:      #00abae;
			--callout-band-fg:   #ffffff;
		}

		// Warning - amber, attention without alarm.
		&.kind-warning {
			--callout-bg:        #fff8eb;
			--callout-border:    #f0d291;
			--callout-band:      #d39003;
			--callout-band-fg:   #ffffff;
		}

		// Trouble - red, "this is where things break".
		&.kind-trouble {
			--callout-bg:        #fff0f0;
			--callout-border:    #f0b3b3;
			--callout-band:      #b91111;
			--callout-band-fg:   #ffffff;
		}

		// Example - neutral gray with a slight green tint, "here's
		// what it looks like in practice".
		&.kind-example {
			--callout-bg:        #f6f7f9;
			--callout-border:    #d6dae0;
			--callout-band:      #4a4f5a;
			--callout-band-fg:   #ffffff;
		}

	}// .helpCallout

</style>
