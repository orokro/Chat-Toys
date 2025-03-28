[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/ChannelPointsPage.vue b/src/renderer/components/options/page_toy_box/pages/ChannelPointsPage.vue[m
[1mindex c990446..6050b7a 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/ChannelPointsPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/ChannelPointsPage.vue[m
[36m@@ -183,7 +183,7 @@[m [mconst ctApp = inject('ctApp');[m
 [m
 // generate slug for command[m
 const toySlug = 'channel_points';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // our local ref settings for this system[m
 const {[m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/ChatBoxPage.vue b/src/renderer/components/options/page_toy_box/pages/ChatBoxPage.vue[m
[1mindex 9eddf73..d82a57c 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/ChatBoxPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/ChatBoxPage.vue[m
[36m@@ -141,7 +141,7 @@[m [mconst ctApp = inject('ctApp');[m
 [m
 // generate slug for command[m
 const toySlug = 'chat_box';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // our local refs state[m
 const {[m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/FishingPage.vue b/src/renderer/components/options/page_toy_box/pages/FishingPage.vue[m
[1mindex d6c1b62..4e9c1e5 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/FishingPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/FishingPage.vue[m
[36m@@ -88,7 +88,7 @@[m [mconst ctApp = inject('ctApp');[m
 [m
 // generate slug for command[m
 const toySlug = 'fishing';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // our local ref settings[m
 const {[m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/GambaPage.vue b/src/renderer/components/options/page_toy_box/pages/GambaPage.vue[m
[1mindex b5eb8ea..414ef54 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/GambaPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/GambaPage.vue[m
[36m@@ -64,7 +64,7 @@[m [mconst ctApp = inject('ctApp');[m
 [m
 // generate slug for command[m
 const toySlug = 'gamba';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // our local ref settings for this system[m
 const {[m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/HeadPatsPage.vue b/src/renderer/components/options/page_toy_box/pages/HeadPatsPage.vue[m
[1mindex a4e7827..9e3ee49 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/HeadPatsPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/HeadPatsPage.vue[m
[36m@@ -65,7 +65,7 @@[m [mconst ctApp = inject('ctApp');[m
 [m
 // generate slug for command[m
 const toySlug = 'head_pats';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // local settings refs[m
 const { [m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/MediaPage.vue b/src/renderer/components/options/page_toy_box/pages/MediaPage.vue[m
[1mindex bc32e6c..97c2bf2 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/MediaPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/MediaPage.vue[m
[36m@@ -79,7 +79,7 @@[m [mimport ArrayMediaEdit from '../../ArrayMediaEdit.vue';[m
 [m
 // generate slug for command[m
 const toySlug = 'media';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // fetch the main app state context[m
 const ctApp = inject('ctApp');[m
[36m@@ -121,7 +121,7 @@[m [mfunction reconcileMediaAssets(currentCommands){[m
 [m
 			// create a new media asset object[m
 			newMediaAssets.push({[m
[31m-				commandSlug: slug,[m
[32m+[m				[32mcommandSlug: slugify(slug),[m
 				commandName: command.command,[m
 				hasImage: true,[m
 				imageId: "6",[m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/PrizeWheelPage.vue b/src/renderer/components/options/page_toy_box/pages/PrizeWheelPage.vue[m
[1mindex 2f48a05..07ade26 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/PrizeWheelPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/PrizeWheelPage.vue[m
[36m@@ -116,7 +116,7 @@[m [mconst ctApp = inject('ctApp');[m
 [m
 // generate slug for command[m
 const toySlug = 'prize_wheel';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // make a yup schema that disallows escape characters, as well as one to validate color strings[m
 const itemSchema = yup.string().matches(/^[^\\]+$/, 'Escape characters are not allowed');[m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/StreamBuddiesPage.vue b/src/renderer/components/options/page_toy_box/pages/StreamBuddiesPage.vue[m
[1mindex ba2de7b..a428191 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/StreamBuddiesPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/StreamBuddiesPage.vue[m
[36m@@ -46,7 +46,7 @@[m [mconst ctApp = inject('ctApp');[m
 [m
 // generate slug for command[m
 const toySlug = 'stream_buddies';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // our local ref settings for this system[m
 const { [m
[1mdiff --git a/src/renderer/components/options/page_toy_box/pages/TosserPage.vue b/src/renderer/components/options/page_toy_box/pages/TosserPage.vue[m
[1mindex 3dee028..389dd88 100644[m
[1m--- a/src/renderer/components/options/page_toy_box/pages/TosserPage.vue[m
[1m+++ b/src/renderer/components/options/page_toy_box/pages/TosserPage.vue[m
[36m@@ -110,7 +110,7 @@[m [mimport ArrayTosserEdit from '../../ArrayTosserEdit.vue';[m
 [m
 // generate slug for command[m
 const toySlug = 'tosser';[m
[31m-const slugify = (text) => (toySlug + '_' + text.toLowerCase());[m
[32m+[m[32mconst slugify = (text) => (toySlug + '__' + text.toLowerCase());[m
 [m
 // fetch the main app state context[m
 const ctApp = inject('ctApp');[m
[1mdiff --git a/src/renderer/scripts/ChatToysApp.js b/src/renderer/scripts/ChatToysApp.js[m
[1mindex d3fb4b3..e4e7051 100644[m
[1m--- a/src/renderer/scripts/ChatToysApp.js[m
[1m+++ b/src/renderer/scripts/ChatToysApp.js[m
[36m@@ -55,7 +55,7 @@[m [mexport default class ChatToysApp {[m
 		this.chatProcessor = new ChatProcessor();[m
 [m
 		this.chatProcessor.onNewChats((messages) => {[m
[31m-			console.log('ChatProcessor received new messages:', messages);[m
[32m+[m			[32m// console.log('ChatProcessor received new messages:', messages);[m
 		});[m
 [m
 		// reusable drag helper[m
[36m@@ -142,5 +142,5 @@[m [mexport default class ChatToysApp {[m
 	resetCommands() {[m
 		this.commands.value = {};[m
 	}[m
[31m-	[m
[32m+[m
 }[m
