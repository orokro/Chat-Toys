<template>
	<div 
		v-if="ready" 
		class="karaokeVideoWidget"
		:class="{ 'idle': currentVideo.state === 'idle' }"
	>
		<div v-if="currentVideo.videoId" class="videoWrapper">
			<!-- We use a key based on videoId + timestamp to force a reload when restarted -->
			<iframe 
				:key="currentVideo.videoId + '_' + currentVideo.timestamp"
				:src="videoUrl" 
				frameborder="0" 
				allow="autoplay; encrypted-media" 
				class="ytIframe">
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

const videoUrl = computed(() => {
	if (!currentVideo.value.videoId) return '';
	
	let url = `https://www.youtube.com/embed/${currentVideo.value.videoId}?autoplay=1&controls=0&enablejsapi=1&iv_load_policy=3&modestbranding=1&rel=0`;
	
	// If paused, we can't easily pause an iframe from outside without the API, 
	// but for now, we assume if it's set to 'paused' the user just doesn't want it visible or we'll let it keep running
	// In a more complex version we would use window.postMessage to the iframe.
	
	return url;
});

// If the state is 'paused', we could hide the video, but usually streamers just want it to keep going
// until they manually stop it or it finishes. 
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
