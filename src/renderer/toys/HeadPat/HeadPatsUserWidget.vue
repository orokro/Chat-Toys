<!--
	HeadPatsUserWidget.vue
	----------------------

	This component will be a simple wrapper for the HeadPatsWidget,
	except we tell it's props to show the user profile picture.
-->
<template>
	<HeadPatsWidget
		:showProfilePicture="true"
		:noKeepAlive="true"
		@boxChange="reEmitBoxChange"
	/>
</template>
<script setup>

// vue
import { ref, watch, computed, inject } from 'vue';

// other components
import HeadPatsWidget from './HeadPatsWidget.vue';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'headPat';
const widgetSlug = 'chat';

// set up our live-light code
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits([
	'boxChange'
]);

const reEmitBoxChange = (box) => {
	emit('boxChange', box);
}

</script>
<style lang="scss" scoped>

</style>
