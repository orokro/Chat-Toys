<!--
	CommandsConfigBox.vue
	---------------------

	This is the component that each of the various toys will use to configure their commands.
-->
<template>

	<!-- main outer wrapper -->
	<div class="commandsConfigBox">

		<!-- the header -->
		<div class="header">
			<h2>{{ toy.static.name }} Commands / Triggers:</h2>
			<button 
				v-if="enableCustomCommands"
				class="addCommandButton"
				@click="addCommand"
			>Add Command</button>
		</div>

		<!-- the list of commands -->
		<div class="commandsList">

			<!-- header for the table -->
			<div class="commandHeaderRow">
				<div
					class="cellEnabled cell"
					title="Enable or Disable Commands"
				>Enable</div>		
				<div
					class="cellSuper cell"
					title="Command is only available to Super Chat messages"
				>Super Only</div>		
				<div
					class="cellMember cell"
					title="Command is only available to Members"
				>Member Only</div>					
				<div 
					class="cellCmd cell" 
					title="The command/trigger string"
				>Command</div>
				<div
					class="cellParams cell"
					title="Optional parameters"
				>Params</div>
				<div
					class="cellCost cell"
					title="Optional User-Channel-Points Cost"
				>
					<div 
						v-if="isChannelPointsEnabled==false"
						class="costWarning"
						v-tippy="'Channel Points are not enabled, costs will be ignored'"
					>
						⚠️
					</div>
					Cost
				</div>
				<div 
					class="cellCoolDown cell"
					title="How long in seconds before user can invoke this command again"
				>User<br>Cool Down</div>
				<div
					class="cellGroupCoolDown cell"
					title="How long in seconds before this command can be invoked again by any user"
				>Group<br>Cool Down</div>
				<div 
					class="cellDesc cell"
					title="Description of the command"
				>Description</div>				
			</div>

			<template 
				v-for="command in toy.localCommandsList.value"
				:key="command.slug"
			>
				<div
					class="commandRow"
					:class="{ 'disabled': !command.enabled, 'shadowed': clashOf(command) && !clashOf(command).active }"
				>
					
					<div class="cellEnabled cell">
						<input
							type="checkbox"
							v-model="command.enabled"
							@input="handleEnabledCheckbox(command)"
						>
					</div>
					<div class="cellSuper cell">
						<input
							type="checkbox"
							v-model="command.superOnly"
							@input="handleSuperChatOnlyCheckbox(command)"
						>
					</div>
					<div class="cellMember cell">
						<input
							type="checkbox"
							v-model="command.memberOnly"
							@input="handleMemberOnlyCheckbox(command)"
						>
					</div>					
					<div class="cellCmd cell">
						<div class="cmdText">
							<span
								v-if="clashOf(command)"
								class="clashIcon material-icons"
								v-tippy="clashText(command)"
							>warning</span>
							!{{ command.command }}
						</div>
						<div class="editButton" @click="(e)=>doEdit(command, 'command')">✏️</div>
					</div>
					<div class="cellParams cell">
						<template v-if="command.params">
							<div
								v-for="param in command.params"
								:key="param.name"
								class="paramText"
								:title="`${param.optional ? '(OPTIONAL)' : '(REQUIRED)'} [${param.type}]: ${param.desc}`"
							>
								{{ `<${param.name}>` }}
							</div>&nbsp;
						</template>
						<div
							v-else
							class="noParams"
						>
						<i class="iNA">N/A</i>
						</div>
					</div>
					<div class="cellCost cell">
						<div v-if="command.costEnabled">
							₱ {{ command.cost }}							
						</div>
						<div v-else>
							<i class="iNA">N/A</i>
						</div>
						<div v-if="command.costEnabled" class="editButton" @click="(e)=>doEdit(command, 'cost')">✏️</div>
					</div>
					<div class="cellCoolDown cell">
						<span class="clockIcon">🕒</span>{{ command.coolDown }}<i>s</i>
						<div class="editButton" @click="(e)=>doEdit(command, 'coolDown')">✏️</div>
					</div>
					<div class="cellGroupCoolDown cell">
						<span class="clockIcon">🕒</span>{{ command.groupCoolDown }}<i>s</i>
						<div class="editButton" @click="(e)=>doEdit(command, 'groupCoolDown')">✏️</div>
					</div>
					<div class="cellDesc cell" :class="{ 'custom': command.custom }">
						<div v-if="!(command.custom)" class="descText">
							{{ command.description }}
						</div>
						<div v-else class="descText">
							<i>Custom. Check Toy Docs for info.</i>
							<span
								class="deleteButton material-icons"
								@click="(e)=>deleteCustomCommand(command.slug)">
								delete
							</span>
						</div>
					</div>
				</div>

				<!-- another running toy uses the same word -->
				<div
					v-if="clashOf(command)"
					class="clashRow"
					:class="{ shadowed: !clashOf(command).active }"
				>
					<span class="material-icons">warning</span>
					<span class="clashMsg">{{ clashText(command) }}</span>
					<button class="clashFix" @click="doEdit(command, 'command')">Rename</button>
				</div>
			</template>
		</div>
		
	</div>
</template>
<script setup>

// vue
import { shallowRef, onMounted, watch, computed, inject } from 'vue'
import { chromeShallowRef } from '../../scripts/chromeRef';
import { directive as VTippy } from 'vue-tippy';
import 'tippy.js/dist/tippy.css';

// components
import EditCommandModal from './EditCommandModal.vue';
import ConfirmModal from './ConfirmModal.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"
import ChannelPoints from '@toys/ChannelPoints/ChannelPoints';
import { takenCommandWords } from '../../scripts/commandLookup';

// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// fetch the main app state context
const ctApp = inject('ctApp');

// props
const props = defineProps({

	// reference to the instance of the toy
	toy: {
		type: Object,
		required: true
	},

	// allow custom commands
	enableCustomCommands: {
		type: Boolean,
		default: false
	}

});



// true if we have at 'channel_points' enabled in ctApp.enabledToys.value
const isChannelPointsEnabled = computed(()=>
	ctApp.enabledToys.value.includes(ChannelPoints.slug));


// how each command stands against other RUNNING toys' commands (reactive:
// the CommandProcessor rebuilds it when commands or running toys change)
const standings = computed(()=>
	(ctApp.commandProcessor && ctApp.commandProcessor.lookup.value.bySlug) || {});


/**
 * The clash for a command, if another running toy has an enabled command with
 * the same word (and this one is enabled too).
 *
 * @param {Object} command
 * @returns {?{word: String, active: Boolean, others: Array<String>}}
 */
function clashOf(command){
	const st = standings.value[command.slug];
	if (!st || !command.enabled || st.others.length === 0)
		return null;
	return st;
}


/**
 * Human name of the toy a command slug belongs to.
 *
 * @param {String} slug - e.g. 'horseRacing__joinrace'
 * @returns {String}
 */
function toyNameOfSlug(slug){
	const toySlug = String(slug).split('__')[0];
	const t = ctApp.toysData && ctApp.toysData.asObject && ctApp.toysData.asObject[toySlug];
	return (t && t.name) || toySlug;
}


/**
 * @param {Object} command
 * @returns {String} explanation for the clash row / tooltip
 */
function clashText(command){
	const st = clashOf(command);
	if (!st) return '';
	const names = Array.from(new Set(st.others.map(toyNameOfSlug))).join(', ');
	return st.active
		? `!${st.word} is also a command in ${names}. This one answers it, so theirs won't respond. Rename one of them.`
		: `!${st.word} is also a command in ${names}, which was added first and answers it, so this one won't respond. Rename one of them.`;
}



// when we mount, we need to reconcile the commands list
onMounted(()=>{

	// reconcile the commands list so our local array is up to date
	props.toy.reconcileCommandsList();
});


// watch the commands ref for changes
watch(commandsRef, ()=>{

	// console.log('commands ref changed');
	// console.log(commandsRef.value);
	// reconcile the commands list so our local array is up to date
	props.toy.reconcileCommandsList();
});


/**
 * Get a list of unique commands from a data object
 * 
 * @param {Object} data the data object to search for commands
 * @returns {Array<String>} an array of unique commands
 */
function getUniqueCommands(data) {
    const commands = new Set();
    
    for (const key in data) {

        if (data[key] && typeof data[key] === 'object' && 'command' in data[key])
            commands.add(data[key].command);
        
    }// next key
    
    return Array.from(commands);
}


/**
 * Words a command can't be renamed to: the other commands of RUNNING toys,
 * plus this toy's own other commands. Toys that aren't running may share a
 * word (they can't both answer it). The command's own current word is
 * allowed, so saving it unchanged works.
 *
 * @param {Object} command
 * @returns {Array<String>}
 */
function reservedWordsFor(command){
	return Array.from(takenCommandWords(
		commandsRef.value,
		ctApp.enabledToys.value,
		{ exceptSlug: command.slug, includeToy: props.toy.slug }));
}


/**
 * Open the edit command modal to edit a specific field in a command
 * 
 * @param {Object} command the command object to edit
 * @param {String} field the field to edit
 */
async function doEdit(command, field){

	const response = await promptModal(EditCommandModal, {
		commandDetails: command,
		kind: field,
		initialValue: command[field],
		reservedCommands: reservedWordsFor(command)
	});

	// if response was cancel or closed, then we don't need to do anything
	if(response==null || response.button==='cancel')
		return;

	// if response was save, then we need to update the command
	if(response.button==='save'){

		// update the command
		command[field] = response.value;

		// update the commands ref
		commandsRef.value = { ...commandsRef.value, [command.slug]: command };
	}
}


/**
 * Handle when the enabled checkbox is toggled
 * 
 * @param {Object} command the command object to update
 */
function handleEnabledCheckbox(command){
	
	// update the commands ref
	command.enabled = !command.enabled;
	commandsRef.value = { ...commandsRef.value, [command.slug]: command };
}


/**
 * Handle when the super chat only checkbox is toggled
 * 
 * @param {Object} command the command object to update
 */
function handleSuperChatOnlyCheckbox(command){
	
	// update the commands ref
	command.superOnly = !command.superOnly;
	commandsRef.value = { ...commandsRef.value, [command.slug]: command };
}


/**
 * Handle when the member only checkbox is toggled
 * 
 * @param {Object} command the command object to update
 */
function handleMemberOnlyCheckbox(command){
	
	// update the commands ref
	command.memberOnly = !command.memberOnly;
	commandsRef.value = { ...commandsRef.value, [command.slug]: command };
}


/**
 * Add a new command to the list
 */
function addCommand(){

	// first we need to get a list of all the current commands
	const commands = commandsRef.value;
	const currentCommands = getUniqueCommands(commandsRef.value);

	// use props.toy.slug as the prefix for the new command and increment number
	// till we find one that's not in use
	let newCommandIndex = 1;
	let newCommandSlug = `${props.toy.slug}__${newCommandIndex}`;
	while(commands.hasOwnProperty(newCommandSlug))
		newCommandSlug = `${props.toy.slug}__${++newCommandIndex}`;
	
	// now that we got a slug, do the same for the actual command text
	newCommandIndex = 1;
	let newCommandText = `${props.toy.slug}_${newCommandIndex}`;
	while(currentCommands.includes(newCommandText))
		newCommandText = `${props.toy.slug}_${++newCommandIndex}`;

	// create a new command object
	const newCommand = {
		slug: newCommandSlug,
		command: newCommandText,
		params: null,
		description: '',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
		custom: true
	};

	// update the commands ref
	commandsRef.value = { ...commandsRef.value, [newCommandSlug]: newCommand };
}


/**
 * Delete a custom command
 * 
 * @param {String} slug the slug of the command to delete
 */
async function deleteCustomCommand(slug){
	
	// prompt the user to confirm the delete with our custom modal
	const response = await promptModal(ConfirmModal, {
		title: 'Are you sure?',
		prompt: `Are you sure you want to delete command ${slug}?`,
		buttons: ['yes', 'nevermind'],
		icon: 'warning'
	});

	// if the response was null or not the 'yes' button, return
	if(response==null)
		return;
	if(response.index!==0)
		return;

	// get the current commands
	const currentCommands = { ...commandsRef.value };

	// remove the command
	delete currentCommands[slug];

	// update the commands ref
	commandsRef.value = currentCommands;
}

</script>
<style lang="scss" scoped>

	// outer most wrapper
	.commandsConfigBox {

		// reset stacking context
		position: relative;

		// box settings
		// thicc round border, and since this element is a predictable table, let's hard-code it's width
		border: 2px solid black;
		border-radius: 10px;
		width: 1000px;
		overflow: hidden;

		// this element will be in dark theme just to contrast it against everything else, since it's an important element
		background: rgb(172, 172, 172);

		// make room for fixed header on top:
		padding: 50px 0px 0px 0px;

		// force header on top as black bar:
		.header {
			
			// fixed on top
			position: absolute;
			inset: 0px 0px auto 0px;
			height: 50px;
			padding: 10px 10px;

			// black bar with white text, smaller font
			/* background: rgb(65, 64, 64); */
			background: black;
			color: white;
			font-size: 12px;
			border-bottom: 2px solid black;

			// optional button to add commands
			.addCommandButton {
				position: absolute;
				top: 10px;
				right: 10px;

				// box styles
				background: #EFEFEF;
				border: none;
				border-radius: 40px;
				padding: 5px 10px;
				cursor: pointer;
				border: 2px solid black;

				// text settings
				color: black;
				font-weight: bolder;
				
				&:hover {
					background: white;
					border: 2px solid rgba(255, 255, 255, 1);					
				}

			}// .addCommandButton

		}// .header

		// commands list can take up the rest of the space
		.commandsList {

			// fill the space
			width: 100%;
			height: 100%;

			// the header row for the table
			.commandHeaderRow {

				background: rgb(83, 83, 83);
				
				// text settings for header
				color: #EFEFEF;
				font-size: 12px;
				text-align: center;
				line-height: 12px;

			}// .commandHeaderRow

			// one of the rows in the list
			.commandRow, .commandHeaderRow {

				// for now we'll just hard code rows, as opposed to some kind of delicate flexbox
				// reset stacking context
				position: relative;
				height: 40px;

				// separation border except on last row
				border-bottom: 2px solid black;
				&:last-child {
					border-bottom: none;
				}

				font-size: 12px;
				overflow: hidden;

				// when the row is disabled
				&.disabled {

					color: gray;
					
					.paramText, .cmdText {
						background-color: gray !important;
					}

					.clockIcon {
						opacity: 0.5;
					}
				}

				// takodatchi
				.iNA {
					font-size: smaller;
					opacity: 0.5;
				}

				// fix box positions
				.cell {
					position: absolute;
					overflow: hidden;
					top: 0px;
					bottom: 0px;
					border-right: 1px solid black;

					// flex align text vertical center
					display: flex;
					justify-content: center;
					align-items: center;
		
					// muh edit button
					.editButton {

						// hidden by default
						scale: 0;
						transition: all 0.2s;

						// fixed on left
						position: absolute;
						left: 5px;

						// appear clickable to user & light upu on over
						cursor: pointer;
						&:hover {
							background: rgba(0, 0, 0, 0.5);
						}

						// gray circle w/ pencil
						background: rgba(0, 0, 0, 0.3);
						width: 25px;
						height: 25px;
						border-radius: 50%;
						text-align: center;
					}// .editButton

					&:hover {
						.editButton {
							scale: 1;
						}
					}

				}// .cell


				// specific cell setting below
				.cellEnabled {
					left: 0px;
					width: 50px;

					// black checkbox
					input {
						width: 20px;
						height: 20px;
						
						// set input theming to black
						accent-color: black;
						outline: none;
						border-radius: 5px;
					}
				}

				.cellSuper {

					left: 50px;
					width: 46px;

					// black checkbox
					input {
						width: 20px;
						height: 20px;
						
						// set input theming to black
						accent-color: black;
						outline: none;
						border-radius: 5px;
					}
				}

				.cellMember {

					left: 96px;
					width: 58px;

					// black checkbox
					input {
						width: 20px;
						height: 20px;
						
						// set input theming to black
						accent-color: black;
						outline: none;
						border-radius: 5px;
					}
				}

				.cellCmd {
					left: 154px;
					width: 150px;

					.cmdText {
						display: inline-block;
						padding: 0px 10px;
						border-radius: 5px;
						background: black;
						color: white;
						font-family: 'Courier New', Courier, monospace;

					}// .cmdText
				}
				.cellParams {
					left: 304px;
					width: 150px;

					.paramText {

						display: inline-block;
						padding: 0px 5px;
						margin-right: 5px;
						border-radius: 15px;
						background: black;
						color: white;
						font-family: 'Courier New', Courier, monospace;

						&:last-child {
							margin-right: 0px;
						}
					}// .paramText

				}
				.cellCost {
					left: 454px;
					width: 66px;
				}
				.cellCoolDown {
					left: 520px;
					width: 100px;
				}
				.cellGroupCoolDown {
					left: 620px;
					width: 100px;
				}
				.cellDesc {
					left: 720px;
					right: 0px;

					.descText {
						width: 100%;
						padding-left: 10px;
						text-align: left;
						line-height: 14px;
					}		
					
					&.custom {

						.deleteButton {
							position: absolute;
							right: 5px;
							top: 50%;
							transform: translateY(-50%);
							cursor: pointer;

							&:hover {
								color: red;
							}
						}// .deleteButton
					}
				}// .cellDesc

			}// .commandRow

			// a command whose word another running toy also uses
			.commandRow.shadowed {
				box-shadow: inset 4px 0 0 #e8912d;
			}
			.cmdText .clashIcon {
				font-size: 14px;
				vertical-align: -3px;
				margin-right: 2px;
				color: #ffd27a;
				cursor: help;
			}
			.clashRow {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 6px 10px;
				font-size: 12px;
				background: #fff4e5;
				color: #6b3d00;
				border-bottom: 2px solid black;
				.material-icons { font-size: 16px; color: #d9822b; }
				.clashMsg { flex: 1 1 auto; }
				.clashFix {
					flex: 0 0 auto;
					border: 0;
					border-radius: 999px;
					padding: 3px 12px;
					font-size: 12px;
					font-weight: 700;
					background: #d9822b;
					color: #fff;
					cursor: pointer;
				}
				.clashFix:hover { filter: brightness(1.08); }
			}
			.clashRow.shadowed {
				background: #ffe8cc;
			}

		}// .commandsList

	}// .commandsConfigBox


</style>
