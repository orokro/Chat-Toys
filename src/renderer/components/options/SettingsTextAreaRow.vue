<!--
	SettingsTextAreaRow.vue
	-----------------------

	A settings row with a multi-line text box. Same row styling as
	SettingsInputRow (title on the left of the top row, description below), but
	the text box spans the full width underneath so longer, multi-line content
	(credits text, messages, lists of names) is comfortable to edit.

	Used by plugin settings of type "text" (the spec's multiline type).
-->
<template>

	<div class="settings-row settings-textarea-row">

		<div class="topRow">
			<h3><slot name="title"></slot></h3>
		</div>

		<div v-if="desc || $slots.default" class="bottomRow">
			<div v-if="desc" class="desc">{{ desc }}</div>
			<slot v-else></slot>
		</div>

		<textarea
			class="settings-textarea"
			:rows="rows"
			:placeholder="placeholder"
			:value="modelValue ?? ''"
			@input="$emit('update:modelValue', $event.target.value)"
		></textarea>

	</div>

</template>
<script setup>

defineProps({
	modelValue: { type: String, default: '' },
	desc: { type: String, default: null },
	placeholder: { type: String, default: '' },
	rows: { type: Number, default: 5 },
});

defineEmits(['update:modelValue']);

</script>
<style lang="scss" scoped>

	.settings-row {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 10px 0px;
		max-width: 1200px;

		:deep(h3) {
			margin-bottom: 0px;
		}
		:deep(p) {
			margin-top: 0px;
			margin-bottom: 0px;
		}
	}

	.topRow {
		margin-top: 5px;
		border-bottom: 5px solid rgba(0, 0, 0, 0.03);
		padding-bottom: 5px;
	}

	.desc {
		font-weight: bold;
	}

	.settings-textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-family: inherit;
		font-size: 14px;
		line-height: 1.4;
		resize: vertical;
	}

</style>
