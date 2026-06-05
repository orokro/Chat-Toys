<!--
	MarkdownBlock.vue
	-----------------

	Renders a markdown string as sanitized HTML (see scripts/markdown.js). Used
	for plugin long-descriptions in the store. Safe to feed untrusted markdown:
	the source is escaped then DOMPurify-sanitized before it ever hits v-html.
-->
<template>
	<div class="markdownBlock" v-html="rendered"></div>
</template>
<script setup>

import { computed } from 'vue';
import { renderMarkdown } from '@scripts/markdown';

const props = defineProps({
	source: { type: String, default: '' },
});

const rendered = computed(() => renderMarkdown(props.source));

</script>
<style lang="scss" scoped>

	.markdownBlock {

		line-height: 1.5;
		color: inherit;

		:deep(h1), :deep(h2), :deep(h3), :deep(h4) {
			margin: 0.6em 0 0.3em;
			line-height: 1.25;
		}
		:deep(h1) { font-size: 1.5em; }
		:deep(h2) { font-size: 1.3em; }
		:deep(h3) { font-size: 1.12em; }

		:deep(p) { margin: 0.5em 0; }

		:deep(ul), :deep(ol) {
			margin: 0.5em 0;
			padding-left: 1.5em;
		}
		:deep(li) { margin: 0.2em 0; }

		:deep(code) {
			background: rgba(0, 0, 0, 0.08);
			padding: 1px 5px;
			border-radius: 4px;
			font-family: ui-monospace, monospace;
			font-size: 0.92em;
		}

		:deep(blockquote) {
			margin: 0.5em 0;
			padding: 2px 12px;
			border-left: 3px solid rgba(0, 0, 0, 0.2);
			opacity: 0.85;
		}

		:deep(hr) {
			border: 0;
			border-top: 1px solid rgba(0, 0, 0, 0.15);
			margin: 0.8em 0;
		}

		:deep(a) { color: #2a7ae2; }

	}// .markdownBlock

</style>
