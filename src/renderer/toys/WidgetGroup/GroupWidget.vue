<!--
	GroupWidget.vue
	---------------

	A widget that renders a group of other widgets within transparent iframes.
-->
<template>
	<div 
		v-if="ready && currentGroup" 
		class="groupWidget"
		:style="{
			width: currentGroup.width + 'px',
			height: currentGroup.height + 'px'
		}"
	>
		<iframe
			v-for="(item, index) in currentGroup.items"
			:key="index"
			:src="item.url"
			class="group-item-iframe"
			:style="{
				left: item.x + 'px',
				top: item.y + 'px',
				width: item.width + 'px',
				height: item.height + 'px',
				transform: `scale(${item.scale || 1})`,
				transformOrigin: 'top left'
			}"
			frameborder="0"
			scrolling="no"
		></iframe>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'WidgetGroup';
const widgetSlug = 'groupLayer';

// keep socket alive
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);

const ready = ref(false);
const socketSettingsRef = useToySettings(thisSlug, 'groupWidgetBox', emit, () => {
	ready.value = true;
});

const query = new URLSearchParams(window.location.search);
const groupName = query.get('name');
const groupIndex = parseInt(query.get('index') || '0', 10);

const currentGroup = computed(() => {
	if (!socketSettingsRef.value || socketSettingsRef.value === 'uninitialized') return null;
	const groups = socketSettingsRef.value.groups || [];
	if (groupName) {
		return groups.find(g => g.name === groupName) || groups[0];
	}
	return groups[groupIndex] || groups[0];
});

</script>

<style lang="scss" scoped>
.groupWidget {
	position: relative;
	overflow: hidden;
	background: transparent;
}

.group-item-iframe {
	position: absolute;
	border: none;
	background: transparent;
	pointer-events: auto;
}
</style>
