<!--
	HelpSection.vue
	---------------

	A documentation-flavored section heading. Each topic body is built
	out of one or more HelpSections. The heading auto-generates an anchor
	id from its title so the table-of-contents (Pass 2) can deep-link to
	specific sections within a topic.

	Visual register: serif title, hairline rule underneath, generous
	top margin. Distinct from the rest of the app's SectionHeader which
	wears the parent PageBox theme color - HelpSection is meant to feel
	like a book page, not a settings tab.
-->
<template>

	<section class="helpSection" :id="anchorId">

		<!-- Anchor link target - the small "§" appears on hover so a
		     reader can copy a stable link to this section. The link
		     intentionally uses # fragment routing handled by the help
		     browser, not the electron window URL. -->
		<component
			:is="headingTag"
			class="helpSectionHeading"
		>
			<a class="anchorTether" :href="`#${anchorId}`" :title="`Link to: ${title}`">
				<span class="material-icons">link</span>
			</a>
			{{ title }}
		</component>

		<div class="helpSectionBody">
			<slot />
		</div>

	</section>

</template>
<script setup>

// vue
import { computed } from 'vue';

// props
const props = defineProps({

	/**
	 * Visible section title. Also seeds the anchor id.
	 */
	title: {
		type: String,
		required: true,
	},

	/**
	 * Optional explicit id - useful when title would slugify to
	 * something ambiguous, or when you want a stable id across renames.
	 */
	id: {
		type: String,
		default: null,
	},

	/**
	 * Heading level. Top-level section in a topic should be h2 (since
	 * the topic title itself is h1 in the browser chrome). Nested
	 * sub-sections can pass level=3 for h3, etc.
	 */
	level: {
		type: Number,
		default: 2,
	},

});

/**
 * Resolve to one of h2..h6. Clamps so we never emit h1 (reserved for
 * the topic-level title rendered by the HelpBrowser shell).
 *
 * @returns {string} an HTML heading tag name
 */
const headingTag = computed(() => {
	const lvl = Math.max(2, Math.min(6, props.level | 0));
	return `h${lvl}`;
});

/**
 * Derive a kebab-case anchor id from the title (or the explicit
 * `id` prop if provided). Strips non-alphanumerics, collapses
 * whitespace, lowercases.
 *
 * @returns {string} a DOM-safe id
 */
const anchorId = computed(() => {
	if (props.id) return props.id;
	return String(props.title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
});

</script>
<style lang="scss" scoped>

	.helpSection {

		// generous top margin so sections read as distinct pages of
		// the book, not as a continuous rolling list
		margin: 40px 0 24px 0;

		&:first-child {
			margin-top: 0;
		}

		.helpSectionHeading {

			// book-feeling serif heading. Falls through to a stack
			// that's available without needing to ship a font.
			font-family: Georgia, 'Times New Roman', serif;
			font-weight: 600;
			color: #1f2240;

			// hairline rule under the title - signature documentation
			// look. Padding-bottom + thin border gives the rule.
			padding-bottom: 6px;
			margin-bottom: 18px;
			border-bottom: 1px solid rgba(38, 34, 98, 0.18);

			// reset stacking so the anchorTether can sit on the left
			position: relative;
			line-height: 1.25;

			// anchor link hidden until the heading is hovered
			.anchorTether {

				// pull into the left margin
				position: absolute;
				left: -32px;
				top: 50%;
				transform: translateY(-50%);

				// muted look
				color: rgba(38, 34, 98, 0.35);
				text-decoration: none;
				opacity: 0;
				transition: opacity 0.15s ease;

				.material-icons {
					font-size: 20px;
				}

				&:hover {
					color: rgba(38, 34, 98, 0.85);
				}

			}// .anchorTether

			&:hover .anchorTether {
				opacity: 1;
			}

		}// .helpSectionHeading

		.helpSectionBody {

			// readable line-length and book-paper-ish line-height for
			// the body. The actual color comes from the help browser
			// body styles - this just controls the rhythm.
			line-height: 1.6;
			font-size: 15px;
			color: #2b2b35;

			// nice book-style paragraph spacing
			:deep(p) {
				margin: 0 0 14px 0;
			}

			:deep(p:last-child) {
				margin-bottom: 0;
			}

			:deep(ul), :deep(ol) {
				margin: 0 0 14px 22px;

				li {
					margin-bottom: 6px;
				}
			}

			// inline code styling
			:deep(code) {
				font-family: 'Courier New', Courier, monospace;
				font-size: 13.5px;
				background: rgba(38, 34, 98, 0.08);
				padding: 1px 6px;
				border-radius: 4px;
				color: #1f2240;
			}

		}// .helpSectionBody

	}// .helpSection

</style>
