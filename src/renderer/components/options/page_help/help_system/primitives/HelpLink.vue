<!--
	HelpLink.vue
	------------

	Internal cross-link between help topics. Renders as a normal-looking
	hyperlink, but on click drives the help browser's navigation stack
	rather than the Electron window URL. This is the lynch-pin that
	lets every topic file reference every other topic without ever
	risking a hard navigation away from the app.

	Usage:
	  <HelpLink to="toys.horseRacing">horse racing</HelpLink>
	  <HelpLink to="concepts.commandSchema#cooldown">cooldown rules</HelpLink>

	A `#fragment` after the topic id is preserved and re-applied after
	the topic mounts, so links can deep-jump into a HelpSection anchor.

	The actual navigation is performed by injecting a `helpNav` API at
	the HelpBrowser shell level. Pass 2 may add things like a history
	stack to that API; this component doesn't care - it just calls
	`helpNav.goto(id, fragment)`.
-->
<template>

	<a
		class="helpLink"
		:href="hrefForCopy"
		:title="resolvedTitle"
		@click="onClick"
	>
		<slot>{{ resolvedTitle }}</slot>
	</a>

</template>
<script setup>

// vue
import { computed, inject } from 'vue';


// props
const props = defineProps({

	/**
	 * Target topic id, optionally with a `#anchor` fragment.
	 * e.g. "toys.horseRacing" or "concepts.commandSchema#cooldown".
	 */
	to: {
		type: String,
		required: true,
	},

});


// help-navigation API provided by the HelpBrowser shell. We default
// to a no-op so the component is safe to render outside of a help
// browser (e.g. in a unit test or a Storybook preview).
const helpNav = inject('helpNav', {
	goto: () => {},
	resolveTitle: () => null,
});


/**
 * Split "topicId#fragment" into its parts.
 *
 * @returns {{ id: string, fragment: (string|null) }}
 */
const parsedTarget = computed(() => {
	const raw = String(props.to || '');
	const hashIdx = raw.indexOf('#');
	if (hashIdx < 0) return { id: raw, fragment: null };
	return {
		id: raw.slice(0, hashIdx),
		fragment: raw.slice(hashIdx + 1) || null,
	};
});


/**
 * Pretty href for things like middle-click "copy link address" or
 * accessibility tools - never actually followed because we always
 * preventDefault in onClick. The `help:` scheme is intentional so
 * that even if an errant click somehow leaks through, the browser
 * shows nothing useful rather than navigating to a real URL.
 *
 * @returns {string}
 */
const hrefForCopy = computed(() => {
	const { id, fragment } = parsedTarget.value;
	return fragment ? `help:${id}#${fragment}` : `help:${id}`;
});


/**
 * Resolve the topic's title via the injected helpNav (for the
 * tooltip and the default slot text when no children are provided).
 * Falls back to the raw id if the registry doesn't know the target.
 *
 * @returns {string}
 */
const resolvedTitle = computed(() => {
	const { id } = parsedTarget.value;
	return helpNav.resolveTitle?.(id) || id;
});


/**
 * Drive the help browser nav. Prevents the default anchor navigation
 * so the Electron window stays put.
 *
 * @param {MouseEvent} e
 */
function onClick(e) {
	e.preventDefault();
	const { id, fragment } = parsedTarget.value;
	helpNav.goto(id, fragment);
}

</script>
<style lang="scss" scoped>

	.helpLink {

		// classic book-link blue, but a touch desaturated so it
		// doesn't shout against the documentation paper.
		color: #2b4cb3;
		text-decoration: underline;
		text-decoration-color: rgba(43, 76, 179, 0.45);
		text-underline-offset: 2px;
		cursor: pointer;

		&:hover {
			color: #1c3a99;
			text-decoration-color: currentColor;
		}

		&:active {
			color: #102978;
		}

	}// .helpLink

</style>
