<!--
	PluginPermsModal.vue
	--------------------

	One-time consent prompt shown before a plugin is enabled (install / import /
	add), and again only when an update requests NEW permissions. Resolves true
	(allow) or false (cancel) via the jenesius promptModal contract.
-->
<template>

	<ModalWindowFrame :title="isUpdate ? 'Update permissions' : 'Allow this plugin?'" :width="460" :height="modalHeight">

		<div class="permsModal">

			<div class="head">
				<img v-if="icon" class="icon" :src="icon" alt="" @error="(e)=>e.target.style.visibility='hidden'" />
				<div class="name">{{ name }}</div>
			</div>

			<p class="lead">
				<template v-if="isUpdate">This update additionally wants to:</template>
				<template v-else><strong>{{ name }}</strong> wants permission to:</template>
			</p>

			<ul class="permList">
				<li v-for="p in perms" :key="p">
					<span class="material-icons check">check_circle</span>
					{{ permLabel(p) }}
				</li>
			</ul>

			<div class="actions">
				<button class="btn cancel" @click="resolve(false)">Cancel</button>
				<button class="btn allow" @click="resolve(true)">
					{{ isUpdate ? 'Allow & Update' : 'Allow & Add' }}
				</button>
			</div>

		</div>
	</ModalWindowFrame>
</template>
<script setup>

import { computed } from 'vue';
import ModalWindowFrame from './ModalWindowFrame.vue';
import { Modal } from 'jenesius-vue-modal';
import { permLabel } from '../../plugins/pluginPerms';

const props = defineProps({
	name: { type: String, default: 'This plugin' },
	icon: { type: String, default: '' },
	perms: { type: Array, default: () => [] },
	isUpdate: { type: Boolean, default: false },
});

// ModalWindowFrame needs a fixed height (its content is absolute-filled), so
// size it to the number of permission lines.
const modalHeight = computed(() => Math.min(560, 210 + props.perms.length * 36));

const emit = defineEmits([Modal.EVENT_PROMPT]);

/**
 * Close the modal, returning the user's choice.
 *
 * @param {boolean} allowed
 */
function resolve(allowed) {
	emit(Modal.EVENT_PROMPT, allowed);
}

</script>
<style lang="scss" scoped>

	.permsModal {
		padding: 18px 20px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}
	.icon { width: 48px; height: 48px; object-fit: contain; }
	.name { font-size: 20px; font-weight: 800; }

	.lead { margin: 0 0 10px; font-size: 14px; }

	.permList {
		list-style: none;
		margin: 0 0 18px;
		padding: 0;

		li {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 0;
			font-size: 14px;
		}
		.check { color: #2e7d32; font-size: 20px; }
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.btn {
		border: 0;
		border-radius: 8px;
		padding: 9px 18px;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}
	.btn.cancel { background: #eee; color: #333; }
	.btn.cancel:hover { background: #e0e0e0; }
	.btn.allow { background: #E0A21F; color: #fff; }
	.btn.allow:hover { filter: brightness(1.07); }

</style>
