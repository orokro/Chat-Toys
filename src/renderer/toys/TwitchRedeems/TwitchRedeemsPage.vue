<!--
	TwitchRedeemsPage.vue
	---------------------

	Settings page for the TwitchRedeems tool toy.

	Two main concerns:
	  1. A picker UI for creating new rewardId -> commandSlug mappings.
	     Reward side is a Helix-fetched dropdown when the broadcaster
	     has Channel Points enabled; falls back to manual entry when
	     getCustomRewards returns empty (non-Affiliate / not yet rolled
	     into Monetization for All).
	  2. A table of existing mappings, each toggleable / removable.

	Mappings are stored by rewardId (stable) and display rewardTitle
	(may be renamed by streamer at any time). Commands are stored by
	slug (stable) and display the current command text.
-->
<template>

	<PageBox
		title="Twitch Redeems"
		themeColor="darkviolet"
		themeImage="assets/bg_tiles/channelPoints.png"
	>
		<br><br>
		<p>
			Map your Twitch channel point redeems to ChatToys commands.
			When a viewer redeems a configured reward, ChatToys will fire
			the mapped command as if they had typed it in chat.
		</p>
		<p class="hint">
			Requires the new <strong>Twitch (Twurple)</strong> connection from the
			Connection Settings tab. Channel Points must also be enabled on your
			Twitch channel (Affiliate or higher, or Monetization for All if rolled out
			to your account).
		</p>

		<SectionHeader title="General Settings" />

		<div class="settingsBlock">
			<SettingsInputRow type="boolean" v-model="enabled">
				<template #title>Enable Twitch Redeems</template>
				<p>When enabled, ChatToys will route Twitch channel point redemptions to their mapped commands.</p>
			</SettingsInputRow>
		</div>

		<SectionHeader title="Redeem Mappings" />

		<!-- Add-mapping form -->
		<div class="addForm">
			<h3>Add a Mapping</h3>

			<!-- Reward picker. Dropdown when we have fetched rewards;
			     manual entry fallback otherwise. User can flip into
			     manual mode explicitly for cases where they want to
			     pre-stage a mapping for a reward they haven't created
			     yet, or for testing via the Debug tab. -->
			<div class="formRow">
				<label>Reward</label>
				<div class="formField">
					<select v-if="!manualMode && availableRewards.length > 0" v-model="newRewardId">
						<option value="">— pick a reward —</option>
						<option
							v-for="r in availableRewards"
							:key="r.id"
							:value="r.id"
						>{{ r.title }} ({{ r.cost }} pts)</option>
					</select>
					<template v-else>
						<input
							type="text"
							v-model="newRewardTitleManual"
							placeholder="Reward title (e.g. 'Toss something')"
						/>
						<input
							type="text"
							v-model="newRewardIdManual"
							placeholder="Reward ID (paste from Twitch, or leave blank)"
						/>
					</template>
					<div class="formMode">
						<button
							class="linkBtn"
							@click="manualMode = !manualMode"
							v-if="availableRewards.length > 0"
						>
							{{ manualMode ? 'Use rewards from Twitch' : 'Enter manually instead' }}
						</button>
					</div>
				</div>
			</div>

			<!-- Command picker. Pulls from chatToysApp.commands.value so
			     every enabled command across every toy is selectable. -->
			<div class="formRow">
				<label>Fires Command</label>
				<div class="formField">
					<select v-model="newCommandSlug">
						<option value="">— pick a command —</option>
						<option
							v-for="cmd in commandOptions"
							:key="cmd.slug"
							:value="cmd.slug"
						>!{{ cmd.command }} ({{ cmd.toySlug }})</option>
					</select>
				</div>
			</div>

			<div class="formActions">
				<button
					class="primaryBtn"
					:disabled="!canAddMapping"
					@click="addMapping"
				>+ Add Mapping</button>
				<button class="linkBtn" @click="refreshRewards" :disabled="rewardsLoading">
					{{ rewardsLoading ? 'Refreshing…' : 'Refresh rewards from Twitch' }}
				</button>
			</div>

			<!-- Fetch status / error breadcrumbs -->
			<p v-if="rewardsErrorMsg" class="fetchMsg error">
				⚠️ Could not load rewards from Twitch: {{ rewardsErrorMsg }}
			</p>
			<p v-else-if="!rewardsLoading && availableRewards.length === 0 && rewardsHasFetched" class="fetchMsg muted">
				No Channel Point rewards found on your channel. Use manual entry to pre-stage a mapping
				(useful for testing via System → Debug, or if you haven't created any rewards on Twitch yet).
			</p>
		</div>

		<!-- Mappings table -->
		<div v-if="mappings.length === 0" class="emptyState">
			<p>No redeems mapped yet — add one above.</p>
		</div>

		<div v-else class="mappingsTable">
			<div class="mappingHeader">
				<div class="colReward">Reward</div>
				<div class="colArrow"></div>
				<div class="colCommand">Command</div>
				<div class="colEnabled">Enabled</div>
				<div class="colRemove"></div>
			</div>

			<div
				v-for="(m, idx) in mappings"
				:key="m.rewardId + '_' + idx"
				class="mappingRow"
			>
				<div class="colReward">
					<div class="rewardTitle">{{ m.rewardTitle || '(untitled)' }}</div>
					<div class="rewardId">{{ m.rewardId }}</div>
				</div>
				<div class="colArrow">→</div>
				<div class="colCommand">
					<code v-if="commandTextFor(m.commandSlug)">!{{ commandTextFor(m.commandSlug) }}</code>
					<span v-else class="missingCommand">⚠️ command not found ({{ m.commandSlug }})</span>
				</div>
				<div class="colEnabled">
					<input type="checkbox" :checked="m.enabled" @change="toggleMapping(idx)" />
				</div>
				<div class="colRemove">
					<button class="removeBtn" @click="removeMapping(idx)" title="Remove mapping">✕</button>
				</div>
			</div>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { ref, computed, inject, onMounted, watch } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// Pull the toy instance and its reactive settings refs
const toy = ctApp.toyManager.getToyBySlug('twitchRedeems');
const { enabled, mappings } = toy.settings;


// ---------------------------------------------------------------------------
// Rewards fetch state
// ---------------------------------------------------------------------------

/** @type {import('vue').Ref<Array<{id:string,title:string,cost:number,prompt:string,isEnabled:boolean,userInputRequired:boolean}>>} */
const availableRewards = ref([]);

/** @type {import('vue').Ref<boolean>} */
const rewardsLoading = ref(false);

/** @type {import('vue').Ref<boolean>} */
const rewardsHasFetched = ref(false);

/** @type {import('vue').Ref<string>} */
const rewardsErrorMsg = ref('');


// ---------------------------------------------------------------------------
// New-mapping form state
// ---------------------------------------------------------------------------

const newRewardId = ref('');
const newRewardTitleManual = ref('');
const newRewardIdManual = ref('');
const newCommandSlug = ref('');

/**
 * When true, the form shows manual reward-entry inputs rather than the
 * dropdown. Auto-true when there are no fetched rewards; the user can
 * also toggle manually for staging mappings ahead of creating the
 * reward on Twitch.
 */
const manualMode = ref(false);


/**
 * The full command list, derived from chatToysApp.commands.value.
 * We expose only enabled commands and pull along the toySlug for
 * display, since `!toss` could be ambiguous across toys.
 */
const commandOptions = computed(() => {

	const all = ctApp.commands?.value || {};
	const out = [];
	for (const slug of Object.keys(all)) {
		const cmd = all[slug];
		if (!cmd || cmd.enabled === false) continue;
		// slug shape: 'toySlug__commandName' (see Toy.slugify). Custom
		// user-defined commands may use the same prefix pattern; split
		// on the first '__' to recover the owning toy.
		const [toySlug] = String(slug).split('__', 2);
		out.push({ slug, command: cmd.command, toySlug });
	}
	out.sort((a, b) => a.command.localeCompare(b.command));
	return out;
});


/**
 * Lookup the current display text for a command slug (used by the
 * mappings table). Commands can be renamed by the user, so we look up
 * fresh every render rather than caching at mapping-creation time.
 *
 * @param {string} slug
 * @returns {string} the command text (without leading '!') or empty string if missing
 */
function commandTextFor(slug) {
	const all = ctApp.commands?.value || {};
	return all[slug]?.command || '';
}


/**
 * Whether the Add button should be enabled - need a reward identity
 * AND a target command at minimum.
 */
const canAddMapping = computed(() => {

	if (!newCommandSlug.value) return false;

	if (manualMode.value || availableRewards.value.length === 0) {
		// Manual mode: need at least a title. ID is optional - we'll
		// synthesize one from the title if blank, so the row at least
		// renders. Real matching needs a real Twitch reward ID.
		return !!newRewardTitleManual.value?.trim();
	} else {
		return !!newRewardId.value;
	}
});


// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------


/**
 * Fetch the broadcaster's custom rewards from Twitch via the
 * twurple-get-custom-rewards IPC bridge. Handles the non-Affiliate
 * case gracefully - on error or empty result, we just show the manual
 * entry path.
 */
async function refreshRewards() {

	if (!window.twurpleAPI?.getCustomRewards) {
		rewardsErrorMsg.value = 'Twurple bridge not available (preload mismatch).';
		return;
	}

	rewardsLoading.value = true;
	rewardsErrorMsg.value = '';

	try {
		const res = await window.twurpleAPI.getCustomRewards();
		availableRewards.value = res?.rewards || [];
		if (!res?.ok && res?.error) {
			rewardsErrorMsg.value = res.error;
		}
		// If no rewards came back, auto-flip into manual mode so the
		// user has a usable form.
		if (availableRewards.value.length === 0)
			manualMode.value = true;
	} catch (e) {
		rewardsErrorMsg.value = e?.message || String(e);
		availableRewards.value = [];
		manualMode.value = true;
	} finally {
		rewardsLoading.value = false;
		rewardsHasFetched.value = true;
	}
}


/**
 * Add a new mapping from the form fields.
 *
 * In dropdown mode, we already have the canonical {id,title,cost} from
 * Helix. In manual mode, we accept whatever the user typed - if they
 * left the ID blank we synthesize a placeholder so the row at least
 * shows up; they'll need to paste the real Twitch reward ID later for
 * runtime matching to work.
 */
function addMapping() {

	let rewardId = '';
	let rewardTitle = '';

	if (manualMode.value || availableRewards.value.length === 0) {
		rewardTitle = newRewardTitleManual.value?.trim() || '';
		rewardId = newRewardIdManual.value?.trim() || `manual:${slugifyTitle(rewardTitle)}`;
	} else {
		rewardId = newRewardId.value;
		const r = availableRewards.value.find((x) => x.id === rewardId);
		rewardTitle = r?.title || '';
	}

	if (!rewardId || !newCommandSlug.value) return;

	// Reassign the array so chromeShallowRef picks up the change
	// (shallowRefs don't deep-track in-place mutations).
	mappings.value = [
		...mappings.value,
		{
			rewardId,
			rewardTitle,
			commandSlug: newCommandSlug.value,
			enabled: true,
		},
	];

	// Reset the form
	newRewardId.value = '';
	newRewardTitleManual.value = '';
	newRewardIdManual.value = '';
	newCommandSlug.value = '';
}


/**
 * Toggle a mapping's enabled flag in place.
 *
 * @param {number} idx
 */
function toggleMapping(idx) {
	const copy = [...mappings.value];
	copy[idx] = { ...copy[idx], enabled: !copy[idx].enabled };
	mappings.value = copy;
}


/**
 * Remove a mapping by index.
 *
 * @param {number} idx
 */
function removeMapping(idx) {
	const copy = [...mappings.value];
	copy.splice(idx, 1);
	mappings.value = copy;
}


/**
 * Small slug helper for synthesizing manual rewardIds when the user
 * doesn't paste a real one. Output isn't meaningful to Twitch - it's
 * just a stable, unique key for the mapping table.
 *
 * @param {string} s
 * @returns {string}
 */
function slugifyTitle(s) {
	return String(s || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		|| 'untitled';
}


// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
	refreshRewards();
});

</script>
<style lang="scss" scoped>

	.hint {
		font-size: 0.9rem;
		color: #888;
		font-style: italic;
		margin-bottom: 1rem;
	}

	.settingsBlock {
		margin-bottom: 1.5rem;
	}


	.addForm {
		padding: 1rem 1.25rem;
		background: #f7f4ff;
		border: 1px solid #c4b5fd;
		border-radius: 0.5rem;
		margin-bottom: 1.25rem;

		h3 {
			margin: 0 0 0.75rem 0;
			color: #6b21a8;
			font-size: 1.05rem;
		}

		.formRow {
			display: flex;
			align-items: flex-start;
			gap: 1rem;
			margin-bottom: 0.75rem;

			label {
				width: 130px;
				flex-shrink: 0;
				font-weight: 600;
				padding-top: 0.4rem;
			}

			.formField {
				flex: 1;

				select, input {
					width: 100%;
					padding: 0.4rem 0.5rem;
					border: 1px solid #aaa;
					border-radius: 0.3rem;
					font-size: 0.95rem;
					background: white;
					margin-bottom: 0.4rem;

					&:focus {
						border-color: #7c3ae6;
						outline: none;
					}
				}

				.formMode {
					margin-top: 0.25rem;
				}
			}
		}

		.formActions {
			display: flex;
			gap: 0.75rem;
			align-items: center;
			margin-top: 0.75rem;
		}

		.fetchMsg {
			margin-top: 0.75rem;
			font-size: 0.85rem;

			&.error { color: #b91c1c; }
			&.muted { color: #666; }
		}
	}


	.primaryBtn {
		background: #7c3ae6;
		color: white;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.4rem;
		font-weight: 600;
		cursor: pointer;

		&:hover:not(:disabled) { background: #6b21a8; }
		&:disabled {
			background: #d8d2eb;
			cursor: not-allowed;
		}
	}


	.linkBtn {
		background: transparent;
		color: #7c3ae6;
		border: none;
		text-decoration: underline;
		cursor: pointer;
		padding: 0.25rem 0;
		font-size: 0.85rem;

		&:hover:not(:disabled) { color: #6b21a8; }
		&:disabled { color: #aaa; cursor: not-allowed; }
	}


	.emptyState {
		padding: 1rem;
		text-align: center;
		color: #666;
		background: #f9f9fb;
		border-radius: 0.5rem;
	}


	.mappingsTable {
		border: 1px solid #e1d9f0;
		border-radius: 0.5rem;
		overflow: hidden;

		.mappingHeader,
		.mappingRow {
			display: grid;
			grid-template-columns: 1fr 40px 1.2fr 80px 40px;
			align-items: center;
			gap: 0.5rem;
			padding: 0.6rem 0.85rem;
		}

		.mappingHeader {
			background: #eee5fb;
			font-weight: 700;
			color: #4c1d95;
			font-size: 0.85rem;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}

		.mappingRow {
			border-top: 1px solid #f0eaf8;

			&:nth-child(odd) { background: #fbf8ff; }
		}

		.colReward {
			.rewardTitle { font-weight: 600; }
			.rewardId {
				font-size: 0.75rem;
				color: #888;
				font-family: 'Courier New', Courier, monospace;
				margin-top: 0.15rem;
			}
		}

		.colArrow {
			text-align: center;
			font-weight: 700;
			color: #a78bfa;
		}

		.colCommand {
			code {
				background: #ede9fe;
				color: #5b21b6;
				padding: 0.15rem 0.45rem;
				border-radius: 0.25rem;
				font-family: 'Courier New', Courier, monospace;
			}
			.missingCommand {
				color: #b91c1c;
				font-size: 0.85rem;
			}
		}

		.colEnabled {
			text-align: center;
		}

		.colRemove {
			text-align: center;

			.removeBtn {
				background: transparent;
				border: 1px solid #ddd;
				border-radius: 0.3rem;
				padding: 0.2rem 0.45rem;
				cursor: pointer;
				color: #b91c1c;

				&:hover {
					background: #fee2e2;
					border-color: #fecaca;
				}
			}
		}
	}

</style>
