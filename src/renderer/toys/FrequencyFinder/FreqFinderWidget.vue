<!--
	FrequencyFinderWidget.vue
	-------------------------

	Simple widget to show frequently repeated messages.
-->
<template>

	<div
		v-if="ready"
		class="frequencyWidget"
		:class="{
			noShadow: !socketSettingsRef?.showShadow
		}"
		:style="widgetStyle"
	>
		<div
			class="freqRows"
			:class="socketSettingsRef?.stackAlign === 'top' ? 'stackTop' : 'stackBottom'"
		>
			<div
				v-for="item in frequencyItems"
				:key="item.word"
				class="freqRow"
			>
				<span class="freqWord">
					{{ (item.word || '').toUpperCase() }}
				</span>
				<span
					class="freqCount"
					:style="{
						color: 'var(--multColor)'
					}"
				>
					X{{ item.count }}
				</span>
			</div>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'frequencyFinder';
const widgetSlug = 'frequencyWidget';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
};

// keep the socket alive
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits([
	'boxChange'
]);

defineProps({});

// settings
const ready = ref(false);
const socketSettingsRef = useToySettings('frequencyFinder', 'frequencyWidgetBox', emit, () => {
	ready.value = true;
});

// global demo mode flag (app-wide)
const demoMode = socketShallowRefReadOnly('demoMode', false);

// live data from backend
const socketFrequencyItems = socketShallowRefReadOnly(slugify('frequencyItems'), []);

// simple demo data for layout/testing in OBS
const demoFrequencyItems = ref([
	{ word: 'yes', count: 6, ttl: 5 },
	{ word: 'no', count: 3, ttl: 4 },
	{ word: 'maybe', count: 2, ttl: 2 }
]);

// what the template actually uses
const frequencyItems = computed(() => {
	return demoMode.value ? demoFrequencyItems.value : socketFrequencyItems.value;
});

// style computed from settings
const widgetStyle = computed(() => {
	const s = socketSettingsRef.value || {};
	const fontSize = (s.fontSize != null ? s.fontSize : 32) + 'px';
	const fontColor = s.fontColor || '#FFFFFF';
	const multColor = s.multiplierColor || '#FFFF00';
	return {
		color: fontColor,
		'--multColor': multColor,
		fontSize,
	};
});

</script>
<style scoped lang="scss">

	.frequencyWidget {

		// fill parent
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;
		overflow: hidden;

		display: flex;
		align-items: stretch;
		justify-content: stretch;

		// default text shadow; can be disabled with .noShadow
		text-shadow: 0.05em 0.05em 0px black;

		&.noShadow {
			text-shadow: none;
		}

		.freqRows {

			// fill widget
			position: absolute;
			inset: 0;

			display: flex;
			flex-direction: column;
			align-items: flex-start;

			line-height: 0.9em;

			// padding from edges
			padding: 8px;
			gap: 0px;

			// default: stack on bottom
			&.stackBottom {
				justify-content: flex-end;
			}

			// top-align stack
			&.stackTop {
				justify-content: flex-start;
			}

			.freqRow {

				display: flex;
				flex-direction: row;
				align-items: baseline;
				white-space: nowrap;

				.freqWord {
					font-weight: 400; 
					font-weight: 700;
				}// .freqWord

				.freqCount {
					margin-left: 0.5em;
					font-weight: 700;
					/* font-size: 1.15em; */
				}// .freqCount

			}// .freqRow

		}// .freqRows

	}// .frequencyWidget

</style>
