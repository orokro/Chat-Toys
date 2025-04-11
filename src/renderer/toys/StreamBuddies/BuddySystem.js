/*
	BuddySystem.js
	--------------

	This file provides two classes to manage the state of the buddies on the screen.

	Since this logic is a little more involved that other toys, it has been moved
	here and out of the main StreamBuddies.js file.

	The two classes are as follows:

	BuddySystem - the main class that manages the buddies and their state
	Buddy - a class that represents a single buddy and its state

	NOTE: this file does not handle the rendering, which will be done by the
	StreamBuddies widgets.
*/

// vue imports
import { watch, shallowRef } from 'vue';
import StreamBuddies from './StreamBuddies';

// the main money
class BuddySystem {

	/**
	 * Constructs the new BuddySystem
	 * 
	 * @param {StreamBuddies} streamBuddies - reference to the StreamBuddies toy instance
	 * @param {shallowRef<Array<String>>} activeBuddies - a shallowRef to the list of active buddies userIDs
	 * @param {shallowRef<Object>} boxSize - vue 3 ref an object like { width, height }
	 */
	constructor(streamBuddies, activeBuddies, boxSize) {

		// save our references
		this.streamBuddies = streamBuddies;
		this.activeBuddies = activeBuddies;
		this.boxSize = boxSize;

		// store our spawned Buddies in this map
		this.buddiesMap = new Map();

		// store the container dimensions & automatically update them if the box size changes
		this.containerWidth = boxSize.value.width;
		this.containerHeight = boxSize.value.height;
		watch(this.boxSize, () => { this.updateContainerDimensions(); });

		// used for computing delta times
		this.lastTime = undefined;

		// look at our initial list of active buddies & create them. Also manage the buddies if the list changes
		this.syncBuddies();
		watch(this.activeBuddies, () => this.syncBuddies());

		// listen for new chat messages and if one is for one of our buddies, show their chat for some time
		this.handleIncomingChats = this.handleIncomingChats.bind(this);
		this.streamBuddies.chatToysApp.chatProcessor.onNewChats(this.handleIncomingChats);
	}


	/**
	 * Handle when we get new chat messages
	 * 
	 * @param {Array<Object>} chats - list of new messages
	 */
	handleIncomingChats(chats) {

		// loop over all the new messages
		for (const chat of chats) {

			// if the message text starts with ! as if it's a command, then skip it
			if (chat.messageText.startsWith('!'))
				continue;

			// if the message is for one of our buddies, show their chat message for a few seconds
			if (this.buddiesMap.has(chat.authorUniqueID)) {
				const buddy = this.buddiesMap.get(chat.authorUniqueID);
				buddy.showChatMessage(chat.messageText);
			}

		}// next chat

	}


	/**
	 * Update our container measurements
	 */
	updateContainerDimensions() {
		const box = this.boxSize.value;
		this.containerWidth = box.width;
		this.containerHeight = box.height;		
	}


	/**
	 * Synchronize the list of userID's with the spawned buddy objects list
	 */
	syncBuddies() {

		const currentIDs = new Set(this.activeBuddies.value.map(b => b.id));

		// Remove old buddies
		for (const [id, buddy] of this.buddiesMap.entries())
			if (!currentIDs.has(id))
				this.buddiesMap.delete(id);


		// Add new buddies
		for (const buddyInfo of this.activeBuddies.value) 
			if (!this.buddiesMap.has(buddyInfo.id))
				this.buddiesMap.set(buddyInfo.id, new Buddy(buddyInfo.id, buddyInfo.name, this));
	}


	/**
	 * Performs one of the commands for our buddy system
	 * 
	 * @param {String} userID - the youtube users unique author ID for the command
	 * @param {String} username - user name of the command author
	 * @param {String} command - which command to run
	 * @param {String|null} param - optional parameter for the command
	 * @returns {Boolean} - true if the command was handled, false if not
	 */
	doCommand(userID, username, command, param = null) {

		// there's only two commands we'll handle here=: join and leave
		// everything else is handled by the target buddy
		if (command === 'join') {

			// if the user is already in the active buddies list, return false
			if (this.activeBuddies.value.find(user=>user.id==userID)!==undefined) {
				console.log(`User ${userID} already in active buddies.`);
				return false;
			}

			// do not allow joining if we're full
			if (this.activeBuddies.value.length >= this.streamBuddies.settings.maxBuddyCount.value) {
				this.streamBuddies.chatToysApp.log.error(
					`${username}: Sorry, the buddy system is full. Please try again later.`);
				return false;
			}

			// add the user to the active buddies list
			this.activeBuddies.value = [...this.activeBuddies.value, ({id:userID, name:username})];
			console.log(`User ${userID} joined the active buddies.`);	
			return true;

		}else if (command === 'leave') {

			// if the user is not in the active buddies list, return false
			if (this.activeBuddies.value.find(user=>user.id==userID)==undefined) {
				console.log(`User ${userID} not found in active buddies.`);
				return false;
			}

			// remove the user from the active buddies list
			this.activeBuddies.value = this.activeBuddies.value.filter(user => user.id !== userID);
			console.log(`User ${userID} left the active buddies.`);
			return true;
		}		

		// if the user is not in the active buddies list, return false
		if (this.activeBuddies.value.find(user=>user.id==userID)==undefined) {
			this.streamBuddies.chatToysApp.log.error(`${username}: type '!join' to use this command.`);
			return false;
		}

		// get the instance for this userID
		const buddy = this.buddiesMap.get(userID);
		if (!buddy)
			return false;

		// if the command requires a parameter, check if it was provided
		// (currently only hug or attack), but this could be expanded
		// and made more generic in the future
		if ((command === 'hug' || command === 'attack') && !param) {
			console.log(`${command} requires a target user.`);
			return false;
		}

		// tell the buddy to handle the command
		buddy.handleCommand(command, param);
		buddy.username = username;
		return true;
	}


	/**
	 * Our timer code is handled outside this class, this .tick() method will be the clock
	 * for the buddy system.
	 * 
	 * @returns {Object} - the current state of all buddies
	 */
	tick() {

		// compute our delta time since the last time tick() was called
		const timeNow = Date.now();
		if (this.lastTime === undefined)
			this.lastTime = timeNow;		
		const deltaTime = (timeNow - this.lastTime) / 1000.0;
		this.lastTime = timeNow;

		// we will build a new object with the current state of all buddies to return
		const state = {
			buddies: []
		};

		// loop over all our spawned buddy instances and update their state with their own .tick() method
		for (const [id, buddy] of this.buddiesMap.entries()) {
			
			buddy.tick(deltaTime);
			state.buddies.push(buddy.getState());

		}// next [id, buddy]

		return state;
	}


	/**
	 * Clean up the buddy system
	 */
	end(){
		
		// stop listening to the chat processor
		this.streamBuddies.chatToysApp.chatProcessor.removeNewChatsListener(this.handleIncomingChats);

		// clear the buddy map
		this.buddiesMap.clear();
	}
}


/**
 * The Buddy class represents a single buddy and its state
 * 
 * It handles the logic for the buddy's movement, jumping, dancing, hugging, and other actions.
 */
class Buddy {

	/**
	 * Constructs a new Buddy instance
	 * 
	 * @param {String} userID - the unique user ID for this buddy
	 * @param {String} username - the name of the user
	 * @param {BuddySystem} system - a reference to the BuddySystem instance
	 */
	constructor(userID, username, system) {

		// save our references
		this.userID = userID;
		this.username = username;
		this.system = system;

		// our movement variables
		this.x = Math.random() * system.containerWidth;
		this.y = system.containerHeight - 100;
		this.targetX = this.x;
		this.targetY = this.y;
		this.velocityX = 0;
		this.velocityY = 0;
		this.gravity = 980; // px/s^2
		this.inAir = true;
		this.targetUserID = null;

		// our state modes
		this.stateMode = 'idle';
		this.dance = '';
		this.chatMessage = '';

		// our state timers
		this.stateTimer = 0;
		this.fartTime = 0;
		this.chatMessageTime = 0;

		// state flags
		this.hugging = false;
		this.attacking = false;
		this.knockback = false;
		this.jumping = false;
		this.dancing = false;		
		this.farting = false;
	}


	/**
	 * Handle when the user sends a command to us
	 * 
	 * @param {String} command - command to perform
	 * @param {Param|null} param - optional parameter for the command
	 */
	handleCommand(command, param) {

		// main switch
		switch (command) {

			case 'left':
				this.targetX = Math.max(0, this.x - (parseInt(param) || 50));
				this.gotoState('moving');
				break;

			case 'right':
				this.targetX = Math.min(this.system.containerWidth, this.x + (parseInt(param) || 50));
				this.gotoState('moving');
				break;

			case 'jump':
				this.jumping = true;
				this.gotoState('jumping');
				this.velocityY = -500;
				this.velocityX = param === 'left' ? -100 : param === 'right' ? 100 : 0;
				this.targetX = this.x + this.velocityX;
				break;

			case 'sit':
				this.gotoState('sitting');
				break;

			case 'fart':
				this.farting = true;
				this.fartTime = 1.1;
				break;

			case 'dance':
				this.dancing = true;

				// custom times:
				const timeMap = {
					'hiphop': 13 + 27/30,
					'spin': 4 + 2/30,
					'swing': 5 + 7/30,
					'twerk': 15 + 7/30,
				}
				const timeMapKeys = Object.keys(timeMap);

				// use param or pick random from our time map
				this.dance = param || timeMapKeys[Math.floor(Math.random() * timeMapKeys.length)];

				// play animation with correct time
				this.gotoState('dancing', timeMap[this.dance]);
				break;

			case 'hug':

				// search for the target buddy by username
				const hugBuddy = this.system.activeBuddies.value.find(b => b.name.toLowerCase() === param.toLowerCase());
				if (!hugBuddy) {
					console.log(`Buddy ${param} not found for hug.`);
					this.system.streamBuddies.chatToysApp.log.error(`${this.username}: Buddy ${param} not found for hug.`);
					this.targetUserID = null;
					return;
				}

				// if we found the buddy, set our target userID to the buddy's ID & begin hug process
				this.targetUserID = hugBuddy.id;
				this.gotoState('hugging', 2);			
				break;

			case 'attack':

				// search for the target buddy by username
				const targetBuddy = this.system.activeBuddies.value.find(b => b.name.toLowerCase() === param.toLowerCase());
				if (!targetBuddy) {
					console.log(`Buddy ${param} not found for hug.`);
					this.system.streamBuddies.chatToysApp.log.error(`${this.username}: Buddy ${param} not found for attack.`);
					this.targetUserID = null;
					return;
				}

				// if we found the buddy, set our target userID to the buddy's ID & begin attack process
				this.targetUserID = targetBuddy.id;
				this.gotoState('attacking', 2);
				break;

			case 'chat':
				this.chatMessage = command;
				this.chatMessageTime = 5;
				break;

			default:
				return;
				
		}// swatch 
	}


	/**
	 * Goes to a state mode, with optional time (random otherwise)
	 * 
	 * @param {String} state - new state to enter
	 * @param {Number|null} time - OPTIONAL time to stay in this state
	 */
	gotoState(state, time=null) {
		
		// pick random time if not provided
		if (time === null)
			time = Math.random() * 5 + 2;

		// set our state
		this.stateMode = state;
		this.stateTimer = time;
	}


	/**
	 * Does update logic for this buddy
	 * 
	 * @param {Number} deltaTime - delta time since last tick
	 * @returns 
	 */
	tick(deltaTime) {
		
		const moveSpeed = 25;

		// apply gravity always (if the window is resized avatars will fall, etc)
		this.velocityY += this.gravity * deltaTime;
		this.y += this.velocityY * deltaTime;

		// if we're in the air, this will remain true
		this.inAir = true;

		// check if we hit the ground & clamp back up
		if (this.y >= this.system.containerHeight && this.velocityY >= 0) {
			this.y = this.system.containerHeight;
			this.velocityY = 0;
			this.inAir = false;
		}

		// if we're jumping or knockback, handle physics
		if (this.jumping || this.knockback) {

			// apply physics just to X because we already applied gravity
			this.x += this.velocityX * deltaTime;

			// our gravity code at the top of the function already checked if we hit the ground
			// so this.inAir will be false if we did. However, for jumping, we should only care about the .inAir
			// variable if our velocityY is positive (we're going down)
			if (this.inAir==false) {

				// clamp y & return to the ground
				this.y = this.system.containerHeight;

				// clear both / either mode & return to idle since we 'landed'
				this.jumping = this.knockback = false;
				this.gotoState('idle');
			}

			// make sure we're within the bounds of the container
			this.clampPosition();
		}

		// if we're farting..
		if (this.farting) {

			// decrement time and disable state flag when done
			this.fartTime -= deltaTime;
			if (this.fartTime <= 0)
				this.farting = false;
		}

		// if we have a chat message up
		if (this.chatMessageTime > 0) {

			// decrement time and disable state flag when done
			this.chatMessageTime -= deltaTime;
		}

		// if we're dancing, decrement our state timer
		if (this.stateMode === 'dancing') {

			this.stateTimer -= deltaTime;
			if (this.stateTimer <= 0) {
				this.dancing = false;
				this.dance = '';
				this.gotoState('idle');
			}			
		}

		// if we're in the moving mode, move towards the target x position
		if (this.stateMode === 'moving') {

			// get distance to our target
			const dx = this.targetX - this.x;
			
			// return to idle if we are close enough
			if (Math.abs(dx) < 1) 
				this.gotoState('idle');

			// otherwise move towards the target
			else 
				this.x += Math.sign(dx) * Math.min(moveSpeed * deltaTime, Math.abs(dx));
			
			this.clampPosition();
		}
		
		// if we're in the hugging or attacking mode, move towards the target buddy
		if (this.stateMode === 'hugging' || this.stateMode === 'attacking') {

			// if our flags are already set, then we don't need to move but just wait
			if(this.hugging || this.attacking) {

				// decrement our state timer & gtfo if we're done
				this.stateTimer -= deltaTime;
				if (this.stateTimer <= 0) {
					this.hugging = this.attacking = false;
					this.gotoState('idle');
					this.targetUserID = null;
				}

			}else {

				// get the target buddy
				const targetBuddy = this.system.buddiesMap.get(this.targetUserID);
				if (targetBuddy) {

					this.targetX = targetBuddy.x;

					// if we're too far, keep moving towards them
					const dx = targetBuddy.x - this.x;
					if (Math.abs(dx) > 30) {

						this.x += Math.sign(dx) * Math.min(moveSpeed * deltaTime, Math.abs(dx));
						this.clampPosition();

					// otherwise, we're close enough to hug/attack
					} else {

						// set our flag AS WELL AS the target buddy's flag
						if (this.stateMode === 'hugging') {

							// we've arrived, so now this flag is true until time runs out
							this.hugging = true;1

							this.targetX = targetBuddy.x;
							targetBuddy.targetX = this.x;

							// set the target buddy's hugging flag and state
							targetBuddy.hugging = true;
							targetBuddy.gotoState('hugging', 5);
						}

						if (this.stateMode === 'attacking') {

							// we've arrived, so now this flag is true until time runs out
							this.attacking = true;

							this.targetX = targetBuddy.x;
							targetBuddy.targetX = this.x;

							setTimeout(() => {
								// set target to being knocked back
								const knockBackVelo = (this.x < targetBuddy.x) ? 100 : -100;
								targetBuddy.velocityX = knockBackVelo;
								targetBuddy.velocityY = -500;
								targetBuddy.knockback = true;
								if(targetBuddy.attacking)
									targetBuddy.attacking = false;
								targetBuddy.gotoState('knockback');

							}, 530);
						}
					}
				
				}// end if(targetBuddy)

			}// end if(this.hugging || this.attacking)

		}

		// if we're in idle mode, do nothing until time runs out
		if (this.stateMode === 'idle') {

			this.stateTimer -= deltaTime;
			if (this.stateTimer <= 0) {
				this.targetX = Math.random() * this.system.containerWidth;
				this.stateMode = 'moving';
				this.gotoState('moving');
			}
		}
	};


	/**
	 * Makes sure our avatar is within the bounds of the container
	 */
	clampPosition() {
		this.x = Math.max(0, Math.min(this.x, this.system.containerWidth));
	}


	/**
	 * Sets message text so our renderer can show it
	 * 
	 * @param {String} message - text to show in the chat bubble
	 */
	showChatMessage(message) {
		this.chatMessage = message;
		this.chatMessageTime = 5;
	}


	/**
	 * Get the current state of this buddy
	 * 
	 * @return {Object} - the current state of this buddy
	 */
	getState() {

		// pack up all our state nicely
		return {
			userID: this.userID,
			username: this.username,
			inAir: this.inAir,
			x: this.x,
			y: this.y,
			dir: (this.x < this.targetX) ? 'right' : 'left',
			targetX: this.targetX,
			targetY: this.targetY,
			targetUserID: this.targetUserID,
			stateMode: this.stateMode,
			stateTimer: this.stateTimer,
			hugging: this.hugging,
			attacking: this.attacking,
			knockback: this.knockback,
			dancing: this.dancing,
			dance: this.dance,
			farting: this.farting,
			fartTime: this.fartTime,
			chatMessage: this.chatMessage,
			chatMessageTime: this.chatMessageTime
		};
	}

}

export { BuddySystem, Buddy };
