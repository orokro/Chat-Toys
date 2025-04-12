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
			
			<div class="urlRow">

				<div class="desc"><em>{{ url.desc }}</em></div>
				<div class="inputRow">
					<!-- a read only input that can be copied from: -->
					<input 
						type="text" 
						:value="url.url" 
						readonly
						@focus="$event.target.select()"
						@click="$event.target.select()"
						@copy="$event.target.select()"
					></input>
					<div class="copyButton">
						<span 
							class="material-icons"
							@click="$event.target.closest('.inputRow').querySelector('input').select()"
						>
							content_copy
						</span>
					</div>

				</div>
			</div>

		</template>
	</div>

</template>
<script setup>

// vue
import { ref, inject, computed } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';

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

		// the row for each URL
		.urlRow {

			padding: 10px 20px 20px 20px;

			// alternate BG colors
			&:nth-child(odd) {
				background: rgba(0, 0, 0, 0.05);
			}
			&:nth-child(even) {
				background: rgba(0, 0, 0, 0.1);
			}

			.desc{
				padding: 10px 0px;
			}

			// row with the text box & the copy button
			.inputRow {

				// reset stacking context
				position: relative;

				// fixed height & look like a box
				height: 40px;
				background: white;
				padding: 5px 15px;
				border-radius: 5px;
				border: 2px solid black;
				
				// inner shadow
				box-shadow: inset 0px 0px 5px rgba(0, 0, 0, 0.5);

				// actual text input
				input {

					// fill container
					position: absolute;
					inset: 0px;
					font-size: medium;
					font-family: monospace;
					padding: 0px 10px;
				}

				// the copy button
				.copyButton {

					// position it to the right
					position: absolute;
					inset: 0px 0px 0px auto;
					top: 0px;
					width: 40px;
					cursor: pointer;
					border-left: 2px solid black;

					&:hover {
						background: black;
						span {
							color: white;
						}
					}

					// icon
					span {
						font-size: 1.5em;
						position: relative;
						top: 5px;
						left: 7px;
						color: black;
					}

				}// .copyButton
			}// .inputRow

		}// .urlRow

	}// .widgetURLs

</style>
