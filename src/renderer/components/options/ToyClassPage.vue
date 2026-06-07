<!--
	ToyClassPage.vue
	----------------

	Generic top-level "box" page for one toyClass ('toy' | 'game' | 'tool').
	Replaces the near-identical ToyBoxPage / ToolBoxPage: a left vertical strip
	of the enabled items in this class, plus the selected item's options page.
	Adding a new class is now just another <ToyClassPage toyClass="..."> in
	MainWindow - no new component needed.
-->
<template>

	<VerticalItemsPage
		:verticalItems="verticalItems"
		:selectedTab="selectedSlug"
		:showAddButton="allAdded === false"
		:showDeleteButton="true"
		@changeTab="(tab) => ctApp.selectForClass(toyClass, tab)"
		@addItem="handleAdd"
		@removeItem="(slug) => handleRemove(slug)"
	>

		<!-- nothing in this box yet -> show the add hint -->
		<template v-if="verticalItems.length <= 0">
			<img class="clickToAddFirstToy" :src="emptyImage" alt="arrow" />
		</template>

		<template v-else>
			<div class="toyPageArea" ref="toyPageArea">
				<!-- toySlug + key so the generic plugin page knows WHICH plugin
					it's for, and remounts when the selection changes -->
				<component :is="toyComponent" :toySlug="selectedSlug" :key="selectedSlug" />
			</div>
		</template>

	</VerticalItemsPage>
</template>
<script setup>

// vue
import { ref, computed, watch, inject } from 'vue';

// components
import VerticalItemsPage from './VerticalItemsPage.vue';
import StoreModal from './StoreModal.vue';
import ConfirmModal from './ConfirmModal.vue';

// lib
import { openModal, promptModal } from 'jenesius-vue-modal';

const props = defineProps({
	// which class this page is for
	toyClass: { type: String, default: 'toy' },
	// singular label for modal titles + confirm copy ("Toy", "Game", "Tool")
	addLabel: { type: String, default: 'Toy' },
	// empty-state image
	emptyImage: { type: String, default: 'assets/click_to_add_first_toy.png' },
});

const ctApp = inject('ctApp');

// the selection ref for this class, surfaced as a reactive value
const selectionRef = ctApp.getSelectionRef(props.toyClass);
const selectedSlug = computed(() => selectionRef.value);

// the enabled items in this class
const verticalItems = computed(() => {
	return ctApp.enabledToys.value
		.map((slug) => ctApp.toysData.asObject[slug])
		.filter((t) => t && (t.toyClass || 'toy') === props.toyClass);
});

// true once every (non-hidden) item of this class has been added. Hidden
// legacy toys don't count toward the total, so the "+" button can disappear
// once all addable toys are present.
const allAdded = computed(() => {
	const total = ctApp.toysData.filter((t) => (t.toyClass || 'toy') === props.toyClass && !t.hidden).length;
	return verticalItems.value.length >= total;
});

// the options page for the selected item (guarded to this class)
const toyComponent = computed(() => {
	const slug = selectedSlug.value;
	const c = slug && ctApp.toysData.asObject[slug];
	if (!c || (c.toyClass || 'toy') !== props.toyClass)
		return null;
	return c.optionsPageComponent;
});

const toyPageArea = ref(null);


/**
 * Confirm + remove an item from this box.
 *
 * @param {string} slug
 */
async function handleRemove(slug) {

	const details = ctApp.toysData.asObject[slug];
	const response = await promptModal(ConfirmModal, {
		title: 'Are you sure?',
		prompt: `Are you sure you want to remove the ${props.addLabel.toLowerCase()}: ${details.name}?`,
		buttons: ['yes', 'nevermind'],
		icon: 'warning',
	});

	if (response == null || response.index !== 0)
		return;

	ctApp.removeToy(slug);
}


/**
 * Open the unified store. It's class-agnostic (one storefront for everything)
 * and handles add + routing to the new item itself, so there's no return value
 * to act on here.
 */
function handleAdd() {
	openModal(StoreModal);
}


// reset scroll when the selected item changes
watch(selectedSlug, () => {
	if (toyPageArea.value)
		toyPageArea.value.scrollTop = 0;
});

</script>
<style lang="scss" scoped>

	.toyBoxPage {

		position: absolute;
		inset: 0;

		.vItemsStrip {
			position: absolute;
			inset: 0px auto 0px 0px;
		}

	}// .toyBoxPage

	// image to guide user to add their first item
	.clickToAddFirstToy {
		position: relative;
		top: 30px;
		left: 30px;
	}

</style>
