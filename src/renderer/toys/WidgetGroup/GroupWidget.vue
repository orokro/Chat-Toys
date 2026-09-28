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
				transformOrigin: 'top left',
				border: 'none'
			}"
			frameborder="0"
			scrolling="no"
		></iframe>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
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

/*
	OBS only tells the TOP page of a browser source when the source is shown or
	hidden (obsSourceVisibleChanged / obsSourceActiveChanged). Widgets inside
	this group are iframes, so relay those events down to them; plugin widgets
	use it (e.g. Credits restarts its scroll when the end-screen scene comes on).
	The receiving side is PluginWidgetHost.vue.
*/
const VISIBILITY_MSG = 'ct-obs-source-visibility';
const VISIBILITY_REQ = 'ct-obs-source-visibility-request';
const obsVisibility = { visible: true, active: true };

// every OBS event goes to every item, marked as a real transition
function broadcastVisibility() {
	const msg = { type: VISIBILITY_MSG, ...obsVisibility, event: true };
	document.querySelectorAll('.group-item-iframe').forEach((f) => {
		try { f.contentWindow && f.contentWindow.postMessage(msg, '*'); }
		catch (_) { /* frame gone */ }
	});
}

const onObsVisible = (e) => { obsVisibility.visible = !!(e && e.detail && e.detail.visible); broadcastVisibility(); };
const onObsActive = (e) => { obsVisibility.active = !!(e && e.detail && e.detail.active); broadcastVisibility(); };

// an item that just mounted asks for the current state (not a transition)
const onItemMessage = (e) => {
	if (!e.data || e.data.type !== VISIBILITY_REQ || !e.source)
		return;
	try { e.source.postMessage({ type: VISIBILITY_MSG, ...obsVisibility, event: false }, '*'); }
	catch (_) { /* frame gone */ }
};

onMounted(() => {
	window.addEventListener('obsSourceVisibleChanged', onObsVisible);
	window.addEventListener('obsSourceActiveChanged', onObsActive);
	window.addEventListener('message', onItemMessage);
});
onBeforeUnmount(() => {
	window.removeEventListener('obsSourceVisibleChanged', onObsVisible);
	window.removeEventListener('obsSourceActiveChanged', onObsActive);
	window.removeEventListener('message', onItemMessage);
});

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
