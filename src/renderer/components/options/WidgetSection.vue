<!--
	WidgetSection.vue
	-----------------

	Shows the URLs to use for individual widgets for a toy.

	I.E. if the user wants to use a browser capture on a per-toy basis.
-->
<template>

	<SectionHeader :title="title"/>
	<p>The <strong>{{ toy.static.name }}</strong> toy provides <strong>{{ countSentence.w }}</strong>.</p>
	<p>Use the {{ countSentence.u }} below as an OBS browser source!</p>

	<!-- the list of widget URLs -->
	<div class="widgetURLs">

		<!-- loop through the widget URLs -->
		<template 
			v-for="(url, i) in toy.getWidgetURLs()"
			:key="`widget-url-${i}`"
		>
			
			<WidgetRow :urlData="url" />

		</template>
	</div>

</template>
<script setup>

// vue
import { ref, inject, computed } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import WidgetRow from './WidgetRow.vue';

const props = defineProps({

	// the toy instance
	toy: {
		type: Object,
		required: true
	}

});

const title = computed(() => {
	return props.toy.static.name + ' Widget URLs';
});

const countSentence = computed(() => {
	const urls = props.toy.getWidgetURLs();
	const plural = urls.length > 1;
	const widgetText = plural ? 'widgets' : 'widget';
	const urlText = plural ? 'URLs' : 'URL';
	return {
		w: `${urls.length} ${widgetText}`,
		u: urlText
	};
});

</script>
<style lang="scss" scoped>

	.widgetURLs {

		// stuff
		line-height: inherit;

	}// .widgetURLs

</style>
