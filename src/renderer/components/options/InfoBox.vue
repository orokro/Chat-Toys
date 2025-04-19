<!--
	InfoBox.vue
	-----------

	This component is mainly to be used in the various PageBox components.

	It's purpose is to display either a quick tip or warning to the user.
-->
<template>
	<div class="infoBoxRow">
		<div class="infoBox">
			<div class="icon">
				<span class="material-icons">{{ props.icon }}</span>
			</div>
			<div class="content">
				<slot></slot>
			</div>
		</div>

	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';

// props
const props = defineProps({

	// the type of info box
	icon: {
		type: String,
		default: 'warning'
	},

});

</script>
<style lang="scss" scoped>

	// invisible row to keep the info boxes from stacking
	.infoBoxRow {

		// for debug
		/* border: 1px solid red; */

		// space around
		margin: 10px 0px;

		// styled box w/ content
		.infoBox {

			overflow: hidden;

			/* display: inline-block; */
			// solid pill shape
			/* background: black; */
			border-radius: 30px;
			min-height: 50px;


			// reset stacking context
			position: relative;

			// fill the icon area on the left
			padding-left: 60px;

			.icon {

				// icon area
				position: absolute;
				left: 0px;
				top: 0px;
				bottom: 0px;
				width: 60px;;
				display: flex;
				justify-content: center;
				align-items: center;

				border-right: 2px solid white;

				// icon
				span {
					font-size: 30px;
					color: white;
					
				}

			}// .icon

			.content {
				padding: 5px 10px;
				min-height: 50px;
				/* opacity: 0.8; */

				// make the text the most opposite of the background
				/* color: white; */
				/* mix-blend-mode:luminosity; */
				background: rgba(255, 255, 255, 0.8);
			}

		}// .infoBox
		
	}// .infoBoxRow

</style>
