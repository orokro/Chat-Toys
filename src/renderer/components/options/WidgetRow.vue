<!--
	WidgetRow.vue
	-------------

	One of the widget rows for the WidgetSection.vue component.
-->
<template>
	<div class="urlRow">

		<div class="desc"><em>{{ urlData.desc }}</em></div>
		
		<div 
			class="statusLight"
			:title="liveStatusText"
			:class="{
				'live': isLive,
				'obs': statusCode === 'O',
				'browser': statusCode === 'B',
			}"
		></div>

		<URLCopyBox class="urlBox" :url="urlData.url" />
	</div>

</template>
<script setup>

// vue
import { ref, inject, computed } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefReadOnly, socketRefAsync, bindRef, bindRefs } from 'socket-ref';

// components
import URLCopyBox from '@components/options/URLCopyBox.vue';

// define some props
const props = defineProps({

	// the URL object
	urlData: {
		type: Object,
		required: true
	}
});


// make a socket ref looking for the live-state of the toy
const socketSlug = `live-state-${props.urlData.toySlug}-${props.urlData.widgetSlug}`;
const liveStatus = socketShallowRefReadOnly(socketSlug, 'U_0');


// keep now ref updated so we can trigger the computed
const now = ref(Date.now());
const interval = setInterval(() => {
	now.value = Date.now();
}, 1000);


// computed property keep track if the toy is in a live state or not
const isLive = computed(() => {

	// get the time stored in the socket value
	const statusTime = parseInt(liveStatus.value.split('_')[1]);
	// console.log(socketSlug, liveStatus.value, (now.value - statusTime));
	return (now.value - statusTime) < (10*1000);
});


// computed property to get the status code
const statusCode = computed(() => {

	// U - Uninitialized
	// B - Browser (not OBS)
	// O - OBS

	// get the time and method stored in the socket value
	const statusCode = liveStatus.value.split('_')[0];
	return statusCode;
});


// computed property to get the live status text tooltip
const liveStatusText = computed(() => {

	if (isLive.value) {
		if(statusCode.value === 'O') {
			return 'Live, detected in OBS';
		} else if (statusCode.value === 'B') {
			return 'Live, detected in some Browser';
		} else {
			return 'Live';
		}
	} else {
		return 'Not Live';
	}
});

</script>
<style lang="scss" scoped>

	// the row for each URL
	.urlRow {

		// reset stacking context
		position: relative;

		padding: 10px 20px 20px 20px;

		// alternate BG colors
		&:nth-child(odd) {
			background: rgba(0, 0, 0, 0.05);
		}
		&:nth-child(even) {
			background: rgba(0, 0, 0, 0.1);
		}

		.desc{
			padding: 10px 0px 5px 20px;
		}

		.urlBox {
			margin-left: 20px;;
		}

		// live status light
		.statusLight {

			// position it to the left
			position: absolute;
			top: 60px;
			left: 11px;

			// round gray circle when 'off'
			border: 2px solid black;
			width: 20px;
			height: 20px;
			border-radius: 40px;
			background: gray;

			&.live {
				background: rgb(171, 236, 17);

				&.browser {
					background: rgb(255, 208, 0);
				}
			}
		}// .statusLight

	}// .urlRow

</style>
