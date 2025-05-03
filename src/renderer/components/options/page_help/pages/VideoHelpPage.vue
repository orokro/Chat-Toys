<!--
	VideoHelpPage.vue
	-----------------

	Shows page with useful videos on how to use the plugin.
-->
<template>

	<PageBox
		title="Video Help"
		themeColor="#00ABAE"
		themeImage="assets/bg_tiles/videos.png"
	>
		<p>
			<br/>
			All the videos below are also available on the pages where they're relevant, 
			<br/>
			but if you're in a learning mood - you can peruse them all here!
		</p>

		<SectionHeader title="Chat Toys Video Help Library"/>

		<!-- OBS Settings -->
		<YTVideoBox 
			url="https://youtu.be/XyfmKtksFIg"
			width="100%"
		/>
		<br/>

		<!-- Chat Settings -->
		<YTVideoBox 
			url="https://youtu.be/hd7dndoe8X4"
			width="100%"
		/>
		<br/>

		<!-- Assets Database -->
		<YTVideoBox 
			url="https://youtu.be/x8Pf10d15BM"
			width="100%"
		/>
		<br/>

		<!-- Users Database -->
		<YTVideoBox 
			url="https://youtu.be/bWa-IjAIPfI"
			width="100%"
		/>
		<br/>

		<!-- Layout Page -->
		<YTVideoBox 
			url="https://youtu.be/sJOo2MQIhjg"
			width="100%"
		/>
		<br/>

		<!-- Channel Points Page -->
		<YTVideoBox 
			url="https://youtu.be/wGxNc5xE-ww"
			width="100%"
		/>
		<br/>

		<!-- Output Log Toy -->
		<YTVideoBox 
			url="https://youtu.be/fC1Z2l9_rfQ"
			width="100%"
		/>
		<br/>
		
		<!-- Chat Toy -->
		<YTVideoBox 
			url="https://youtu.be/kc-181dg2M8"
			width="100%"
		/>
		<br/>
		
		<!-- Fishing Toy -->
		<YTVideoBox 
			url="https://youtu.be/sm5-RHsqQmI"
			width="100%"
		/>
		<br/>

		<!-- Gamba Toy -->
		<YTVideoBox 
			url="https://youtu.be/lv5cDifVbTc"
			width="100%"
		/>
		<br/>

		<!-- Head Pats Toy -->
		<YTVideoBox 
			url="https://youtu.be/wDCzZFhiU-s"
			width="100%"
		/>
		<br/>

		<!-- Media Toy -->
		<YTVideoBox 
			url="https://youtu.be/35cJEtJNiq8"
			width="100%"
		/>
		<br/>

		<!-- Prize Wheel Toy -->
		<YTVideoBox 
			url="https://youtu.be/JMofM8hf9SI"
			width="100%"
		/>
		<br/>

		<!-- Stream Buddies Toy -->
		<YTVideoBox 
			url="https://youtu.be/7cNTiqa_Kq8"
			width="100%"
		/>
		<br/>

		<!-- Tosser Toy -->
		<YTVideoBox 
			url="https://youtu.be/B4YfacihXjc"
			width="100%"
		/>
		<br/>
		
	</PageBox>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import YTVideoBox from '@components/YTVideoBox.vue';


</script>
<style lang="scss" scoped>	


</style>
