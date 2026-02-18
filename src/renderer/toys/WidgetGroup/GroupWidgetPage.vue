<!--
	GroupWidgetPage.vue
	------------------

	Settings page for the WidgetGroup toy.
-->
<template>
	<PageBox
		title="Widget Group Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/main.png"
		bgSize="120px"
		bgThemePos="-25px"
	>
		<br><br>
		<p>
			Combine multiple toy widgets into a single consolidated layout. 
			Create groups and arrange widgets within them to use as a single browser source in OBS.
		</p>

		<SectionHeader title="Groups" />
		<p>Add or rename layout groups below.</p>
		<div class="settingsBlock">
			<ArrayEdit
				v-model="groups"
				:component="ArrayGroupEdit"
				:createItem="() => ({ name: 'New Group', width: 1920, height: 1080, items: [] })"
			/>
		</div>

		<template v-if="groups.length > 0">
			<SectionHeader title="Layout Editor" />
			<p>Select a group to edit its dimensions and arrange widgets.</p>

			<div class="help-block">
				<div class="help-header" @click="showHelp = !showHelp">
					<span class="material-icons">{{ showHelp ? 'expand_more' : 'chevron_right' }}</span>
					Editor Controls Help
				</div>
				<div class="help-content" v-if="showHelp">
					<ul>
						<li><strong>Zoom:</strong> Mouse Wheel</li>
						<li><strong>Pan:</strong> Right-Click + Drag</li>
						<li><strong>Move Widget:</strong> Click + Drag</li>
						<li><strong>Snap Move:</strong> Hold <strong>Shift</strong> while dragging (10% grid)</li>
						<li><strong>Resize Widget:</strong> Drag handles</li>
						<li><strong>Lock Aspect Ratio:</strong> Hold <strong>Shift</strong> while resizing</li>
						<li><strong>Scale Widget:</strong> Hold <strong>Alt</strong> while resizing (CSS Transform)</li>
						<li><strong>Delete:</strong> (X) icon on top right of widget</li>
						<li><strong>Change Type:</strong> (V) icon on top left of widget</li>
					</ul>
				</div>
			</div>

			<div class="settingsBlock editor-controls">
				<div class="control-group">
					<label>Editing Group:</label>
					<select v-model="selectedGroupIndex">
						<option v-for="(group, index) in groups" :key="index" :value="index">
							{{ group.name }}
						</option>
					</select>
				</div>
				<div class="control-group">
					<label>Width:</label>
					<input 
						type="number" 
						:value="currentGroup.width" 
						@input="e => updateCurrentGroupDim('width', e.target.value)" 
					/>
				</div>
				<div class="control-group">
					<label>Height:</label>
					<input 
						type="number" 
						:value="currentGroup.height" 
						@input="e => updateCurrentGroupDim('height', e.target.value)" 
					/>
				</div>
			</div>

			<GroupEditor 
				v-if="currentGroup"
				:group="currentGroup" 
				@update="handleGroupUpdate"
			/>

			<WidgetSection :toy="toy" :key="`ws-${groups.length}`" />
			
			<div class="url-tip" v-if="currentGroup">
				<p><strong>Pro Tip:</strong> To load a specific group in OBS, append <code>&index={{ selectedGroupIndex }}</code> or <code>&name={{ encodeURIComponent(currentGroup.name) }}</code> to the widget URL above.</p>
			</div>
		</template>

	</PageBox>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue';
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ArrayGroupEdit from './ArrayGroupEdit.vue';
import GroupEditor from './GroupEditor.vue';
import WidgetSection from '@components/options/WidgetSection.vue';

const ctApp = inject('ctApp');
const toy = ctApp.toyManager.getToyBySlug('WidgetGroup');

const { groups } = toy.settings;

const selectedGroupIndex = ref(0);
const showHelp = ref(true);

const currentGroup = computed(() => {
	if (!groups.value || groups.value.length === 0) return null;
	return groups.value[selectedGroupIndex.value] || groups.value[0];
});

const handleGroupUpdate = (updatedGroup) => {
	const newGroups = [...groups.value];
	newGroups[selectedGroupIndex.value] = updatedGroup;
	groups.value = newGroups;
};

const updateCurrentGroupDim = (prop, val) => {
	const updated = { ...currentGroup.value, [prop]: parseInt(val, 10) || 0 };
	handleGroupUpdate(updated);
};

// Ensure selected index is valid if groups are removed
watch(() => groups.value.length, (newLength) => {
	if (selectedGroupIndex.value >= newLength) {
		selectedGroupIndex.value = Math.max(0, newLength - 1);
	}
}, { immediate: true });

</script>

<style lang="scss" scoped>
.settingsBlock {
	margin-bottom: 30px;
}

.help-block {
	background: #222;
	border: 2px solid black;
	border-radius: 10px;
	margin-bottom: 20px;
	overflow: hidden;
	color: #eee;

	.help-header {
		padding: 10px 15px;
		background: #333;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: bold;
		user-select: none;
		&:hover { background: #444; }
	}

	.help-content {
		padding: 15px;
		font-size: 14px;
		border-top: 1px solid #444;

		ul {
			margin: 0;
			padding-left: 20px;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 5px 20px;
		}

		li { margin-bottom: 5px; }
	}
}

.editor-controls {
	display: flex;
	gap: 20px;
	align-items: center;
	background: #333;
	padding: 15px;
	border-radius: 10px 10px 0 0;
	border: 2px solid black;
	border-bottom: none;
	color: white;

	.control-group {
		display: flex;
		align-items: center;
		gap: 10px;

		label {
			font-weight: bold;
			font-size: 14px;
		}

		select, input {
			background: #222;
			color: white;
			border: 1px solid #555;
			border-radius: 5px;
			padding: 5px 10px;
			outline: none;
			&:focus { border-color: #4A90E2; }
		}

		input { width: 100px; }
	}
}

.url-tip {
	margin-top: 10px;
	padding: 10px;
	background: rgba(74, 144, 226, 0.1);
	border-left: 4px solid #4A90E2;
	border-radius: 4px;
	font-size: 14px;
	code {
		background: rgba(0,0,0,0.1);
		padding: 2px 4px;
		border-radius: 3px;
	}
}
</style>
