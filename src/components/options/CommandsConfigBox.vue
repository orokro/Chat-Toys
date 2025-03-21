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
			<h2>{{ toyName }} Commands / Triggers:</h2>
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
				v-for="command in localCommandsList"
				:key="command.slug"
			>
				<div
					class="commandRow"
					:class="{ 'disabled': !command.enabled }"
				>
					
					<div class="cellEnabled cell">
						<input
							type="checkbox"
							v-model="command.enabled"
							@input="handleEnabledCheckbox(command)"
						>
					</div>					
					<div class="cellCmd cell">
						<div class="cmdText">
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
					<div class="cellDesc cell">
						<div class="descText">
							{{ command.description }}
						</div>
					</div>
				</div>
			</template>
		</div>
		
	</div>
</template>
<script setup>

// vue
import { ref, shallowRef, onMounted, watch, computed } from 'vue'
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';
import { directive as VTippy } from 'vue-tippy';
import 'tippy.js/dist/tippy.css';

// components
import EditCommandModal from './page_toy_box/EditCommandModal.vue';

// lib/ misc
import { openModal, promptModal } from "jenesius-vue-modal"

// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// props
const props = defineProps({

	// the options app
	optionsApp: {
		type: Object,
		default: null
	},

	// title title of commands list
	toyName: {
		type: String,
		default: 'Commands'
	},

	// the toy slug that's also used as a command slug prefix
	toySlug: {
		type: String,
		default: 'toy'
	},

	// the array of command objects to configure
	commands: {
		type: Array,
		default: []
	}

});

// true if we have at 'channel_points' enabled in props.optionsApp.enabledToys.value
const isChannelPointsEnabled = computed(()=>
	props.optionsApp.enabledToys.value.includes('channel_points'));

/*	
	NOTE:
	-----

	Here we have a big comment block because the following is somewhat confusing.

	All of the commands system wide will be stored in the above defined, commandsRef.
	This variable is a chromeShallowRef, so it will be stored in local/plugin storage.

	It will have keys on it's object for EVERY COMMAND in the system, including custom user ones.
	It's essentially the source-of-truth for all commands in the system.

	However, it is never explicitly defined anywhere.

	Rather, this very component will help to initialize it.

	In our props we take in a commands array - this is essentially the default list of commands
	for this toy. When the component mounts we need to compare this list with the list in storage.

	If we don't yet have these in the storage commandsRef, then we can initialize them with the
	commands array from props. However, if we do have them, then we need to load them.

	That's where the array (defined below) comes in. The actual data we'll display onscreen
	will be duplicated from the chrome ref, because we don't want to show ALL commands, just
	the current state of the commands that match the list passed in (via command slug).

	So (also below) when we mount we'll do this comparison - and we'll also set up a watch(),
	on the chrome ref - if the commands are edited elsewhere, we can update our internal array.

	FURTHER: since some command boxes will allow users to add their own custom commands,
	we'll also build our internal list based off the slug prefix.
*/

// the array mentioned above - the local scope ref to display in the component
const localCommandsList = shallowRef([]);

/**
 * Whenever we mount, our props change, or the chrome ref changes, we need to reconcile
 * the commands list with whats default and whats in storage.
 */
function reconcileCommandsList(){

	// we'll build the new local list temporarily here - we'll only update the ref at the end
	const newLocalCommandsList = [];

	// keep track of slugs alone as well
	const newSlugs = [];

	// we'll also keep an object of new commands to merge into the chrome ref if needed
	const newCommands = {};

	// fetch the current object storing all commands system wide
	const commandsState = commandsRef.value;

	// lets loop over every list in our props commands array and see if it already exists
	// in the commands state - if not, we'll add it
	for(let command of props.commands){

		// the slug for this command
		const slug = command.slug;

		// if the commandsState doesn't have this command have this slug as a key, 
		// then we need to add it
		if(!(slug in commandsState)){

			// add it to the new commands object
			newCommands[slug] = command;

			// add it to the new local list
			newLocalCommandsList.push(command);
			newSlugs.push(slug);
		
		}
		// otherwise, we'll just add the command from the commands state
		else {
			newLocalCommandsList.push(commandsState[slug]);
			newSlugs.push(slug);
		}
		
	}// next command

	// if we have any new commands to add, then we'll merge them into the commands state
	if(Object.keys(newCommands).length>0){
		commandsRef.value = { ...commandsState, ...newCommands };
	}

	// before we update the local list, we should also search the keys that 
	// follow the pattern of our toySlug_ prefix - these are custom commands
	// we should pull them from the commands state and add them to our local list
	for(let key in commandsState){

		// if the key starts with our toySlug_ prefix, then we should add it to the local list
		// (if its not already there)
		if(key.startsWith(`${props.toySlug}_`) && newSlugs.includes(key)==false)
			newLocalCommandsList.push(commandsState[key]);		

	}// next key

	// update the local list
	localCommandsList.value = newLocalCommandsList;
}

// when we mount, we need to reconcile the commands list
onMounted(()=>{

	// reconcile the commands list so our local array is up to date
	reconcileCommandsList();
});


// watch the commands ref for changes
watch(commandsRef, ()=>{

	// console.log('commands ref changed');
	// console.log(commandsRef.value);
	// reconcile the commands list so our local array is up to date
	reconcileCommandsList();
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
		reservedCommands: getUniqueCommands(commandsRef.value)
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
				.cellCmd {
					left: 50px;
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
					left: 200px;
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
					left: 350px;
					width: 70px;
				}
				.cellCoolDown {
					left: 420px;
					width: 100px;
				}
				.cellGroupCoolDown {
					left: 520px;
					width: 100px;
				}
				.cellDesc {
					left: 620px;
					right: 0px;

					.descText {
						width: 100%;
						padding-left: 10px;
						text-align: left;
						line-height: 14px;
					}					
				}

			}// .commandRow

		}// .commandsList

	}// .commandsConfigBox


</style>
