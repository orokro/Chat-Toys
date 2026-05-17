<!--
	ToyChip.vue
	-----------

	Small draggable chip representing one alert toy in the Omni page UI.
	Visualizes the toy with its icon (auto-resolved by slug) and its display
	name, styled with its theme color.

	The component just renders + emits drag events; the parent handles the
	actual drop logic and array mutations.
-->
<template>

	<div
		class="toy-chip"
		:style="{ borderColor: themeColor }"
		draggable="true"
		@dragstart="$emit('dragstart', $event)"
		:title="`${toyName} (${toySlug}) - drag to assign`"
	>
		<img
			class="icon"
			:src="`/assets/icons/${toySlug}.png`"
			alt=""
			onerror="this.style.display='none'"
		/>
		<span class="label">{{ toyName }}</span>
	</div>

</template>
<script setup>

import { inject, computed } from 'vue';


const props = defineProps({
	toySlug: { type: String, required: true },
});

defineEmits(['dragstart']);


const ctApp = inject('ctApp');


/** Look up the toy class to source display name + theme color. */
const toyClass = computed(() => ctApp.toysData.asObject[props.toySlug] || null);

const toyName = computed(() => toyClass.value?.name || props.toySlug);

const themeColor = computed(() => toyClass.value?.themeColor || '#888');

</script>
<style lang="scss" scoped>

	.toy-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px 6px 8px;
		background: white;
		border: 2px solid #888;
		border-radius: 24px;
		cursor: grab;
		user-select: none;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
		transition: transform 0.1s ease;

		&:hover {
			transform: translateY(-1px);
			box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
		}

		&:active {
			cursor: grabbing;
		}

		.icon {
			width: 26px;
			height: 26px;
			object-fit: contain;
		}

		.label {
			font-weight: bold;
			font-size: 0.95em;
			color: #222;
		}
	}

</style>
