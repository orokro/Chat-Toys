<!--
	HeadPatsUserWidget.vue
	----------------------

	This component will be a simple wrapper for the HeadPatsWidget,
	except we tell it's props to show the user profile picture.
-->
<template>
	<HeadPatsWidget
		:showProfilePicture="true"
		@boxChange="reEmitBoxChange"
	/>
</template>
<script setup>

// vue
import { ref, watch, computed, inject } from 'vue';

// other components
import HeadPatsWidget from './HeadPatsWidget.vue';

const emit = defineEmits([
	'boxChange'
]);

const reEmitBoxChange = (box) => {
	emit('boxChange', box);
}

</script>
<style lang="scss" scoped>

</style>
