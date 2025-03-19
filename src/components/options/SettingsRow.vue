<!--
	SettingsRow.vue
	---------------

	Similar to the SettingsInputRow.vue,
	but this is just the styled row - no input fields.
-->
<template>
	
	<div class="settings-row">

		<!-- Description -->
		<div v-if="desc" class="desc">{{ desc }}</div>
		<slot v-else></slot>

	</div>

</template>
<script setup>

// vue
import { ref, defineProps } from 'vue';

// props
const props = defineProps({

	// the description of the setting
	desc: {
		type: String,
		default: ''
	},

});

</script>
<style lang="scss" scoped>

	.settings-row {
		
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 10px 0px;
		border-bottom: 5px solid black;
		max-width: 1200px;
		
		:deep(h3) {
			margin-bottom: 0px;
			text-decoration: underline;
		}
		:deep(p) {
			margin-top: 0px;
			margin-bottom: 0px;
		}

	}// .settings-row
</style>
