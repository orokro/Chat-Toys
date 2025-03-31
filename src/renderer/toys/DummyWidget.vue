<!--
	DummyWidget.vue
	---------------

	This will be a place holder widget for the various toys to use for their
	widgets until they are fully implemented.

	This will simply do the bare minimum to show a widget on the screen.
-->
<template>

	<!-- main outermost wrapper -->
	<div
		class="dummyWidget"
		:style="{ '--color': widgetInfo.color }"
	>
		<!-- transparent layer to show theme color -->
		<div class="bgColor">

			<!-- info on the widget we're supposed to show eventually -->
			<h1>Dummy {{ widgetInfo.slug }}.{{ widgetInfo.key }}</h1>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, watch, computed, onMounted } from 'vue';
import { socketRef, socketShallowRef, socketRefAsync, bindRef, bindRefs } from 'socket-ref';

import { useToySettings } from '@toys/useToySettings';

// props
const props = defineProps({
	
	// details on the widget we'll eventually show here instead
	widgetInfo: {
		type: Object,
		required: true
	}
	
});

// events
const emit = defineEmits([
	'boxChange'
]);

// gets the settings for this widget
const settingsSocketRef = useToySettings(props.widgetInfo.slug, props.widgetInfo.key, emit);


</script>
<style lang="scss" scoped>

	// main styles for the outer-most wrapper
	.dummyWidget {

		// box settings - fill the LayoutBox parent container
		border: 1px solid white;
		width: 100%;
		height: 100%;

		// don't let the placeholder text escape
		overflow: hidden;

		// reset h1 size
		h1 {
			font-size: 12px;
		}

		// this layer fills the box as well, but with opacity for the color
		.bgColor {

			// dynamically set the color
			background-color: var(--color);
			opacity: 0.5;
			
			// fill box
			width: 100%;
			height: 100%;

			// center text
			display: flex;
			justify-content: center;
			align-items: center;
			
		}// .bgColor

	}// .dummyWidget
	
</style>
