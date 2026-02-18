<!--
	TierEdit.vue
	------------

	A small component to edit the settings for a single Super Chat tier.
-->
<template>
	<div class="tier-edit" :style="{ '--tierColor': color }">
		
		<div class="tier-label">
			<span class="color-swatch"></span>
			Tier {{ tier }} ({{ name }})
		</div>

		<div class="tier-controls">
			
			<div class="value-input">
				<label>Points:</label>
				<input type="number" :value="data.value" @input="updateValue" />
			</div>

			<div class="enable-toggle">
				<label>Enabled:</label>
				<ToggleCheck :modelValue="data.enabled" @update:modelValue="updateEnabled" />
			</div>

		</div>

	</div>
</template>

<script setup>

// vue
import { defineProps, defineEmits } from 'vue';

// components
import ToggleCheck from '@components/ToggleCheck.vue';

// props
const props = defineProps({
	tier: Number,
	name: String,
	color: String,
	data: Object, // { tier, enabled, value }
});

// emits
const emit = defineEmits(['update:data']);

const updateValue = (e) => {
	const val = parseInt(e.target.value, 10);
	emit('update:data', { ...props.data, value: val });
};

const updateEnabled = (val) => {
	emit('update:data', { ...props.data, enabled: val });
};

</script>

<style lang="scss" scoped>

	.tier-edit {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 15px;
		border: 2px solid black;
		border-radius: 10px;
		margin-bottom: 12px;
		background: #f5f5f5;
		box-shadow: 2px 2px 0px rgba(0,0,0,0.1);

		.tier-label {
			display: flex;
			align-items: center;
			font-weight: bold;
			font-size: 1.1em;
			color: #333;

			.color-swatch {
				width: 24px;
				height: 24px;
				background-color: var(--tierColor);
				border: 2px solid black;
				border-radius: 6px;
				margin-right: 12px;
				box-shadow: 1px 1px 0px rgba(0,0,0,0.2);
			}
		}

		.tier-controls {
			display: flex;
			gap: 25px;
			align-items: center;

			.value-input {
				display: flex;
				align-items: center;
				gap: 10px;

				label {
					font-weight: bold;
					font-size: 0.9em;
					color: #666;
				}

				input {
					width: 100px;
					padding: 6px 10px;
					border: 2px solid black;
					border-radius: 6px;
					font-weight: bold;
					text-align: center;
					box-shadow: inset 1px 1px 2px rgba(0,0,0,0.1);

					&:focus {
						outline: none;
						border-color: darkred;
					}
				}
			}

			.enable-toggle {
				display: flex;
				align-items: center;
				gap: 10px;

				label {
					font-weight: bold;
					font-size: 0.9em;
					color: #666;
				}
			}
		}
	}

</style>
