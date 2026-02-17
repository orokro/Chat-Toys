<template>
	<div 
		v-if="ready" 
		class="karaokeVideoWidget"
		:class="{ 'idle': currentVideo.state === 'idle' }"
	>
		<div v-if="currentVideo.videoId" class="videoWrapper">
			<!-- We use a key based on videoId + timestamp to force a reload when restarted -->
			<iframe 
				ref="iframeRef"
				:key="currentVideo.videoId + '_' + currentVideo.timestamp"
				:src="videoUrl" 
				frameborder="0" 
				allow="autoplay; encrypted-media" 
				class="ytIframe"
				@load="handleIframeLoad">
			</iframe>
		</div>
		<div v-else class="idlePlaceholder"></div>
	</div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'karaokeQueue';
const widgetSlug = 'video';
const slugify = (text) => thisSlug + '__' + text.toLowerCase();

keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);
const ready = ref(false);
const socketSettingsRef = useToySettings(thisSlug, 'videoWidgetBox', emit, () => {
	ready.value = true;
});

const currentVideo = socketShallowRefReadOnly(slugify('currentVideo'), { videoId: null, state: 'idle', timestamp: 0 });

const iframeRef = ref(null);

const videoUrl = computed(() => {
	if (!currentVideo.value.videoId) return '';
	
	let url = `https://www.youtube.com/embed/${currentVideo.value.videoId}?autoplay=1&controls=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&rel=0`;
	return url;
});

function sendCommand(cmd) {
	if (!iframeRef.value || !iframeRef.value.contentWindow) return;
	
	iframeRef.value.contentWindow.postMessage(JSON.stringify({
		event: 'command',
		func: cmd,
		args: ''
	}), '*');
}

// When iframe loads, check if we should immediately pause
function handleIframeLoad() {
	if (currentVideo.value.state === 'paused') {
		sendCommand('pauseVideo');
	}
}

// Watch for state changes to send commands to the iframe
watch(() => currentVideo.value.state, (newState) => {
	const command = newState === 'playing' ? 'playVideo' : 'pauseVideo';
	sendCommand(command);
});

// If the timestamp changes, it means a restart was requested. 
// Since we have :key="currentVideo.videoId + '_' + currentVideo.timestamp" on the iframe,
// Vue will automatically recreate the iframe, which performs a natural restart.
</script>

<style lang="scss" scoped>
.karaokeVideoWidget {
	width: 100%;
	height: 100%;
	background: transparent;
	overflow: hidden;
	transition: opacity 0.5s;

	&.idle {
		opacity: 0;
	}

	.videoWrapper {
		width: 100%;
		height: 100%;
		
		.ytIframe {
			width: 100%;
			height: 100%;
		}
	}

	.idlePlaceholder {
		width: 100%;
		height: 100%;
	}
}
</style>
