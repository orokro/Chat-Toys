<!--
	HelpPage.vue
	------------

	Page with mostly text content to help users understand the plugin.
-->
<template>

	<PageBox title="Help" themeColor="#00ABAE" themeImage="assets/bg_tiles/help.png" bgSize="120px" bgThemePos="10px">
		<div class="picBox" :style="{ height: '350px', }">
			<img src="/assets/chat_solid/help.png" height="300px" style="float:right; margin-top: 200px;" />
		</div>

		<br>

		<div>
			<h1>Contents</h1>
			<ul>
				<li><a href="#application-details">Application Details</a></li>
				<li><a href="#live-widgets">Live Widgets</a></li>
				<li><a href="#layout-page">Layout Page</a></li>
				<li><a href="#users-database">Users Database</a></li>
				<li><a href="#assets-database">Assets Database</a></li>
				<li><a href="#toys">Toys Overview</a></li>
				<ul>
					<li><a href="#chat">Chat</a></li>
					<li><a href="#channel-points">Channel Points</a></li>
					<li><a href="#fishing">Fishing</a></li>
					<li><a href="#media">Media</a></li>
					<li><a href="#headpat">HeadPat</a></li>
					<li><a href="#output-log">Output Log</a></li>
					<li><a href="#prize-wheel">Prize Wheel</a></li>
					<li><a href="#stream-buddies">Stream Buddies</a></li>
					<li><a href="#tosser">Tosser</a></li>
					<li><a href="#gamba">Gamba</a></li>
				</ul>
			</ul>

			<SectionHeader title="Application Details" id="application-details" />
			<p>
				Chat-Toys is a feature-rich, locally hosted streaming utility designed for YouTube Live streamers. Its
				primary function is to allow streamers to build a deeply interactive experience by turning viewer chat
				into direct, visible, and often animated actions on screen. This is accomplished by combining real-time
				chat parsing, a dynamic layout system, and a wide variety of visual "toys" that can be spawned, moved,
				and interacted with via viewer commands.
			</p>
			<p>
				The application creates a local web server that serves HTML/CSS/JS-based visual widgets (called "toys")
				which can be displayed in OBS through browser sources. These widgets respond to YouTube Live chat
				commands in real time. It acts as a self-contained ecosystem for managing user engagement, customizing
				experiences, and delivering personalized responses to your community — all while remaining entirely
				local and private.
			</p>

			<SectionHeader title="Live Widgets" id="live-widgets" />
			<p>
				Live widgets are individual interactive visual elements that appear on your stream. Each widget
				corresponds to a "toy" — a modular, configurable piece of logic and UI. Widgets are injected into the
				stream via a browser source pointing at the locally hosted web server (e.g., http://localhost:3001/live
				or http://localhost:3001/live/?single=true&toy=toyName&widget=widgetName).
			</p>

			<SectionHeader title="Layout Page" id="layout-page" />
			<p>
				The layout page is an optional way where you can visually organize your widgets for the Live Screen. It provides a
				WYSIWYG interface where resize and position the various toys you've enabled.
			</p>

			<SectionHeader title="Users Database" id="users-database" />
			<p>
				The Database/Users tab provides an in-depth interface for tracking every viewer who has interacted with your
				stream. Each user record includes their YouTube channel ID, display name, command usage history,
				participation in streams, points balance, and ban status.
			</p>
			<p>
				You can edit points manually, ban or unban users, view detailed charts of command usage, and see which
				streams a user has joined. This creates a persistent profile for every user who interacts with your
				content, enabling loyalty-based systems, moderation tooling, and user-driven personalization.
			</p>

			<SectionHeader title="Assets Database" id="assets-database" />
			<p>
				The Database/Assets tab is an asset manager for all media files used by toys and widgets. You can import
				custom images, sounds, and 3D models, preview them, or delete them.
			</p>
			<p>
				When importing, files are moved into a managed internal folder and assigned UUIDs for reference. This
				ensures assets can be safely referenced across toys and UI components. Assets can be previewed with
				built-in players or thumbnails.
			</p>

			<SectionHeader title="Toys Overview" id="toys" />
			<p>
				Below you can learn more about each of the toys.
			</p>

			<SectionHeader title="Channel Points" id="channel-points" />
			<p>
				This toy implements a points-based reward system. Users accumulate points over time by being present,
				and typing the command to claim them. (Default is <span class="cmd">!get</span>) Points can be used to trigger toys, actions, or rewards.
			</p>

			<SectionHeader title="Chat" id="chat" />
			<p>
				The chat toy acts as the backbone of the system, parsing YouTube chat in real time. It connects to the
				stream’s live chat, reads every message, and identifies structured commands (e.g., !pat or !fish). It
				then forwards those messages into the system’s internal routing to trigger toys and actions.
			</p>
			<p>
				Without the chat toy active, most interactivity will not function. It handles message parsing, filters
				invalid or irrelevant messages, and supports forwarding messages to multiple widgets.
			</p>

			<SectionHeader title="Fishing" id="fishing" />
			<p>
				A fun toy where users can enter commands like !fish to attempt to "catch" something. The toy responds
				with randomized outcomes, potentially tied to visual or audio feedback. Fish types, rarity levels, and
				success odds are fully configurable.
			</p>
			<p>
				It's designed as a game-like loop to drive recurring engagement. You can also trigger rare finds or
				multi-user events (e.g., group fishing weekends).
			</p>

			<SectionHeader title="Media" id="media" />
			<p>
				This toy allows users to trigger media playback — typically sound effects or short videos — through
				commands. It supports queueing, cooldowns, and previews. Each media clip can be tied to an asset from
				the asset manager.
			</p>
			<p>
				Useful for memes, jump scares, or fan-favorite soundbites, the Media toy helps enrich viewer
				participation with audio-visual responses.
			</p>

			<SectionHeader title="HeadPat" id="headpat" />
			<p>
				This toy lets users show affection to on-screen characters or buddies by issuing commands like !pat. It
				triggers a visual "patting" animation over a character’s head. You can optionally customize the pat
				graphic, sound, or behavior.
			</p>
			<p>
				Often used as a fan-service gesture or to reward viewers. Can be rate-limited or restricted to certain
				users.
			</p>

			<SectionHeader title="Output Log" id="output-log" />
			<p>
				A debug and feedback widget that displays structured logs of chat messages, command responses, or system
				state. It’s visually styled for stream overlays and often used to show confirmation messages (e.g.,
				"User123 just caught a Rare Fish!").
			</p>
			<p>
				It can be filtered, styled, and placed anywhere on screen. Great for transparency and giving feedback to
				viewers.
			</p>

			<SectionHeader title="Prize Wheel" id="prize-wheel" />
			<p>
				A game-like toy that spins a wheel with custom entries, then lands on a random result. Users can trigger
				spins with commands like !spin. It’s great for giveaways, raffles, or random prizes.
			</p>
			<p>
				The wheel supports custom segments, sound effects, and animations. Results can trigger other toys or
				actions.
			</p>

			<SectionHeader title="Stream Buddies" id="stream-buddies" />
			<p>
				A mascot system that spawns animated characters on stream. Buddies can walk, idle, react to events, and
				be "petted" by users. Each buddy can have unique sprites, animations, and states.
			</p>
			<p>
				Viewers often build a relationship with stream mascots. Stream Buddies can be customized by users,
				linked to channel points, or swapped out depending on stream theme.
			</p>

			<SectionHeader title="Tosser" id="tosser" />
			<p>
				A chaotic toy that lets users toss objects (like emotes, items, or memes) onto the screen. These items
				fall with physics and can bounce, stack, or fade out. It’s designed to let users "disrupt" the stream in
				a fun way.
			</p>
			<p>
				You can customize the objects, physics settings, and trigger costs. Great for crowd chaos.
			</p>

			<SectionHeader title="Gamba" id="gamba" />
			<p>
				The Gamba toy allows viewers to place bets or predictions on stream outcomes. It supports opening
				rounds, setting multiple options, collecting bets, and then resolving with winners and payouts.
			</p>
			<p>
				Odds, payout ratios, and cooldowns can be configured. Excellent for competitive games, viewer
				interaction during boss fights, or any moment with a dramatic outcome.
			</p>
		</div>

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

</script>
<style lang="scss" scoped></style>
