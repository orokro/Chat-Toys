<!--
	FilePreview.vue
	---------------

	Renders a thumbnail of a file from our Asset manager.
-->
<template>

	<div 
		v-if="previewSrc" 
		class="filePreview"
		:class="{ border: props.border }"
		:style="{
			width: props.width ? props.width + 'px' : 'auto',
			height: props.height ? props.height + 'px' : 'auto' 
		}"
	>
		<!-- image previews or 3d models will render a thumbnail of said model for now -->
		<img
			v-if="isImage || is3DModel"
			:src="previewSrc"
			alt="File preview"
			:style="{
				maxWidth: '100%',
				maxHeight: '100%'
			}"
		/>

		<!-- use built in audio player for audio source files -->
		<audio
			v-if="isAudio"
			:src="previewSrc"
			controls
			:autoplay="props.autoPlay"
			:style="{
				width: props.width ? props.width + 'px' : '100%'
			}">
		</audio>
	</div>

</template>
<script setup>

// vue
import { ref, watch, onMounted } from 'vue';

// lib/misc
import { getThumb } from '../../scripts/threeThumb';

// props
const props = defineProps({

	// the id of the file to preview
	fileId: String,

	// reference to the asset manager
	assetManager: Object,

	// optional width and height
	width: Number,
	height: Number,

	// optional autoplay (for audio)
	autoPlay: {
		type: Boolean,
		default: false
	},

	// true if we should show a border
	border: {
		type: Boolean,
		default: true
	}
});

// our local state
const previewSrc = ref(null);
const isAudio = ref(false);
const isImage = ref(false);
const is3DModel = ref(false);

// generate a preview of the file, based on the file type
const generatePreview = async () => {

	// reset our state for the new file
	previewSrc.value = null;
	isAudio.value = false;
	isImage.value = false;
	is3DModel.value = false;

	// make sure our required props are set
	if (!props.fileId || !props.assetManager) return;

	// gets a JavaScript File object representing the file
	const file = await props.assetManager.getFile(props.fileId);	
	if (!file) return;

	
	// get the file type & generate a preview
	const fileType = file.type;
	if (fileType.startsWith('image/')) {

		isImage.value = true;
		previewSrc.value = URL.createObjectURL(file);

	} else if (fileType.startsWith('audio/')) {
		isAudio.value = true;
		previewSrc.value = URL.createObjectURL(file);

	// TODO: potentially better support for 3D models
	} else if (file.name.endsWith('.fbx') || fileType === 'model/fbx' || fileType === 'model/gltf-binary') {
		is3DModel.value = true;
		previewSrc.value = await getThumb(file);
	}
};

// when we mount or the fileId changes, generate a preview
onMounted(generatePreview);
watch(() => props.fileId, generatePreview);

</script>
<style lang="scss" scoped>

	// outer wrapper
	.filePreview {

		display: flex;
		justify-content: center;
		align-items: center;
		overflow: hidden;

		&.border {
			border: 2px solid black;
			border-radius: 5px;
		}// &.border

	}// .filePreview

</style>
