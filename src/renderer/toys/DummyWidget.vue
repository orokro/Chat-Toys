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

let settingsSocket = null;
let boxInfo = {
	x: 100,
	y: 100,
	width: 200,
	height: 200
};

// get the string for our socket ref / settings
const socketRefString = computed(() => {

	const slug = props.widgetInfo.slug;
	const blockNameKebab = slug.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	const settingsName = blockNameKebab + '-settings'
	
	return settingsName;
});


// setup the socket
function initSocket(){

	if(settingsSocket!=null)
		return;

	settingsSocket = socketShallowRef(socketRefString.value, 'uninitialized');

	const initCheckInterval = setInterval(()=>{

		if(settingsSocket.value !== 'uninitialized'){

			
			clearInterval(initCheckInterval);
			

			const data = settingsSocket.value;
			boxInfo = data[props.widgetInfo.key];

			console.log('boxInfo', boxInfo);
			emit('boxChange', {
				slug: props.widgetInfo.slug,
				boxKey: props.widgetInfo.boxKey,
				key: props.widgetInfo.key,
				value: boxInfo
			});

		}

	}, 100);

	watch(settingsSocket, (newVal) => {
		if (newVal === 'uninitialized')
			return;
		
		const data = settingsSocket.value;
		boxInfo = data[props.widgetInfo.key];

		emit('boxChange', {
			slug: props.widgetInfo.slug,
			boxKey: props.widgetInfo.boxKey,
			key: props.widgetInfo.key,
			value: boxInfo
		});
	});
}


initSocket();

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
