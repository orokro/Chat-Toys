<!--
	EnabledBTTVList.vue
	------------------

	Displays a grid of all currently enabled BTTV emojis (Global, Channel, and Manual).
	Allows removing manually added emojis.
-->
<template>
	<div class="enabled-bttv-list">
		<div class="grid-container" v-if="allEmojis.length > 0">
			<div 
				v-for="emoji in allEmojis" 
				:key="emoji.id" 
				class="emoji-card"
				:class="{ 'is-manual': emoji.channel === 'manual' }"
			>
				<div class="emoji-image">
					<img :src="emoji.url" :alt="emoji.code" />
				</div>
				<div class="emoji-info">
					<span class="emoji-code">{{ emoji.code }}</span>
					<span class="emoji-source">{{ emoji.channel }}</span>
				</div>
				<button 
					v-if="emoji.channel === 'manual'" 
					class="remove-btn"
					@click="ctApp.bttvMgr.removeManualEmoji(emoji.id)"
					title="Remove manual emoji"
				>
					<span class="material-icons">close</span>
				</button>
			</div>
		</div>
		<div v-else class="empty-state">
			<p>No BTTV emojis enabled.</p>
		</div>
	</div>
</template>

<script setup>
import { computed, inject } from 'vue';

const ctApp = inject('ctApp');

// Convert Map to array for rendering
const allEmojis = computed(() => {
	const list = [];
	ctApp.bttvMgr.emojis.forEach((value, key) => {
		list.push({
			...value,
			code: key
		});
	});
	return list;
});

</script>

<style lang="scss" scoped>
.enabled-bttv-list {
	border: 2px solid black;
	border-radius: 10px;
	background: #acacac;
	padding: 15px;
	max-height: 400px;
	overflow-y: auto;
	margin-top: 10px;

	.grid-container {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 10px;
	}

	.emoji-card {
		background: #222;
		border-radius: 8px;
		padding: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		border: 1px solid #444;

		&.is-manual {
			border-color: #CC4444;
		}

		.emoji-image {
			width: 48px;
			height: 48px;
			display: flex;
			align-items: center;
			justify-content: center;
			margin-bottom: 5px;

			img {
				max-width: 100%;
				max-height: 100%;
				object-fit: contain;
			}
		}

		.emoji-info {
			display: flex;
			flex-direction: column;
			align-items: center;
			width: 100%;
			overflow: hidden;

			.emoji-code {
				color: #eee;
				font-size: 12px;
				font-weight: bold;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				width: 100%;
				text-align: center;
			}

			.emoji-source {
				color: #888;
				font-size: 10px;
				text-transform: uppercase;
			}
		}

		.remove-btn {
			position: absolute;
			top: -5px;
			right: -5px;
			background: #CC4444;
			color: white;
			border: none;
			border-radius: 50%;
			width: 20px;
			height: 20px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			padding: 0;
			box-shadow: 0 2px 4px rgba(0,0,0,0.3);

			.material-icons {
				font-size: 14px;
			}

			&:hover {
				background: #ff4444;
			}
		}
	}

	.empty-state {
		text-align: center;
		padding: 20px;
		color: #444;
		font-style: italic;
	}
}
</style>
