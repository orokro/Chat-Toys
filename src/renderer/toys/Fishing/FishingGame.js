/*
	FishingGame.js
	--------------

	This class handles the state for the Fishing mini-game system.
	NOTE: it does not handle the rendering, which will be the widgets.
*/

// main class!
export class FishingGame {

	/**
	 * Constructs the FishingGame object
	 * 
	 * @param {Array<Object>} corners - Array of objects like {x,y} for the TL, TR, BL, BR corners of the fishing area
	 * @param {shallowRef<Array<Object>>} fishList - shallowRef to the list of fish
	 * @param {ref<Number>} maxFish - vue ref for the maximum number of fish
	 * @param {ref<Number>} fishSpawnInterval - vue ref for the fish spawn interval in seconds
	 * @param {ref<Number>} castTimeout - vue ref for the cast timeout in seconds (auto reel)
	 */
	constructor(corners, fishList, maxFish, fishSpawnInterval, castTimeout) {

		// save our initial params
		this.corners = corners;
		this.fishList = fishList;
		this.maxFish = maxFish;
		this.fishSpawnInterval = fishSpawnInterval;
		this.castTimeout = castTimeout;

		// will store the list of user casts & spawned fish in these
		this.casts = [];
		this.fish = [];

		// not a timer, but rather a number we'll count down
		this.fishSpawnTimer = this.getNewFishSpawnInterval();

		// callbacks that can be set by the UI
		this.logFn = () => { };
		this.catchFn = () => { };
	}


	/**
	 * Sets the function for when the system logs things.
	 * 
	 * TODO: maybe we should support multiple listeners?
	 * @param {Function} fn - sets our singular log function
	 */
	onLog(fn) {
		this.logFn = fn;
	}


	/**
	 * Sets the function for when a fish is caught.
	 * 
	 * TODO: maybe we should support multiple listeners?
	 * @param {Function} fn - sets our singular catch function
	 */
	onCatch(fn) {
		this.catchFn = fn;
	}


	/**
	 * Syntactic sugar for logging
	 * 
	 * @param {String} msg - the message to log
	 */
	log(msg) {
		this.logFn(msg);
	}


	/**
	 * Pick a new random amount of time to wait before spawning a new fish
	 * 
	 * @return {Number} - the new spawn interval in seconds
	 */
	getNewFishSpawnInterval() {
		return Math.random() * this.fishSpawnInterval.value;
	}


	/**
	 * Picks a random fish to spawn, based on the rarity of each fish
	 * 
	 * @returns {Object} - a random fish object from the list
	 */
	getRandomFish() {

		// from our list of fish, total the rarity and use that for our random number
		const list = this.fishList.value;
		const totalRarity = list.reduce((sum, fish) => sum + fish.rarity, 0);
		const rand = Math.random() * totalRarity;

		// basic on the number picked, we'll use the rarity of each fish as a 'range'
		// and based on where our random number falls, we'll pick a fish
		let acc = 0;
		for (const fish of list) {
			acc += fish.rarity;
			if (rand < acc)
				return { ...fish };
		}// next fish

		// if we get here, we didn't pick a fish, so just return the last one
		return { ...list[list.length - 1] };
	}


	/**
	 * Helper method to convert from the game's logical coordinates to the CSS coordinates
	 * 
	 * @param {Number} gameX - logical coordinate on the game grid
	 * @param {Number} gameY - logical coordinate on the game grid
	 * @returns {Object} - an object with screenX and screenY properties
	 */
	toScreenCoords(gameX, gameY) {

		// the corners were passed in our constructor, and define the CSS
		// positions of the TopLeft, TopRight, BottomLeft, and BottomRight corners
		// of the fishing area.  We use these to calculate the screen position
		const [TL, TR, BL, BR] = this.corners;

		// get the top and bottom edge widths, the height of the grid, and the width delta
		const topEdgeWidth = TR.x - TL.x;
		const bottomEdgeWidth = BR.x - BL.x;
		const gridHeight = BL.y - TL.y;
		const widthDelta = bottomEdgeWidth - topEdgeWidth;

		// calculate the screen position based on the game coordinates
		const tempX = gameX / 4;
		const tempY = gameY / 4;
		const localWidth = topEdgeWidth + widthDelta * tempY;
		const screenX = BL.x + (widthDelta / 2) * tempY + localWidth * tempX;
		const screenY = TL.y + tempY * gridHeight;

		// return the screen coordinates
		return { screenX, screenY };
	}


	/**
	 * Does one of the fishing commands - either `cast` or `reel`
	 * 
	 * @param {Object} param0 - parameters for the command wrapped up in an object
	 */
	doCommand({ userID, username, command, params, handshake }) {

		// if we're doing a cast command
		if (command === 'cast') {
			this.doCast({ userID, username, command, params, handshake });
			return;
		}

		if (command === 'reel') {
			this.doReel({ userID, username, command, params, handshake });
			return;
		}
	}


	/**
	 * Performs a cast for a user
	 * 
	 * @param {Object} param0 - params for the cast command wrapped up in an object
	 */
	doCast({ userID, username, command, params, handshake }) {

		// if a user already cast, GTFO
		if (this.casts.find(c => c.userID === userID)){
			handshake.reject('You already have a cast out!');
			return;
		}

		// fill optional x/y position with random
		let x = params?.x ?? Math.random() * 4;
		let y = params?.y ?? Math.random() * 4;
		const { screenX, screenY } = this.toScreenCoords(x, y);

		// add to our list of casts
		this.casts.push({
			userID,
			username,
			castX: x,
			castY: y,
			screenX,
			screenY,
			timer: this.castTimeout.value,
			nibbling: false,
		});

		// this will move nearby fish away
		this.scareNearbyFish(x, y);

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * Does a real for a user
	 * 
	 * @param {Object} param0 - params for the reel command wrapped up in an object
	 */
	doReel({ userID, username, command, params, handshake }) {

		// if the user doesn't have a cast, GTFO
		const cast = this.casts.find(c => c.userID === userID);
		if (!cast){
			handshake.reject('You don\'t have a cast out!');
			return;
		}

		// handle optional params
		const strength = params?.strength ?? 50;

		// get nearby fish
		const nearbyFish = this.fish.find(f => f.mode === 'attract' && f.targetCast?.userID === userID && f.nibbling);
		if (nearbyFish) {

			// Simplified strength logic
			const fishStrength = 50 + Math.random() * 50; 
			if (strength > fishStrength + 20) {
				this.log('Line snapped!');

			} else if (strength < fishStrength - 20) {
				this.log("Fish didn't even feel that.");
				
				// accept the command which updates the database
				handshake.accept();

				// return because cast is still active
				return;

			} else {
				this.log(`Caught a ${nearbyFish.name}!`);
				this.catchFn({ cast, fish: nearbyFish });

				// remove caught fish!
				this.fish = this.fish.filter(f => f !== nearbyFish);
			}
		}

		// remove the cast
		this.casts = this.casts.filter(c => c !== cast);

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * When a cast hits the lake, it should scare nearby fish, if any
	 * 
	 * @param {Number} x - x position of the cast
	 * @param {Number} y - y position of the cast
	 */
	scareNearbyFish(x, y) {

		// loop to check all fish
		for (const f of this.fish) {

			// see how far we are from fish f
			const dx = f.posX - x;
			const dy = f.posY - y;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// if we're close enough, scare the fish away & the modes are correct
			if (dist < 1.5 && f.mode !== 'attract' || (f.mode === 'attract' && !f.nibbling)) {

				// wander new position
				f.mode = 'sadwander';
				f.waitTimer = 0;

				// pick new random position
				const awayX = f.posX + dx * 2;
				const awayY = f.posY + dy * 2;
				f.targetPosX = Math.max(0, Math.min(4, awayX));
				f.targetPosY = Math.max(0, Math.min(4, awayY));
			}

		}// next f
	}


	/**
	 * Updates the game
	 * 
	 * TODO: refactor this logic, potentially add a Fish class to encapsulate the fish logic
	 * @returns {Object} - object describing the current state of the game
	 */
	tick() {

		// if we don't have last tick, set it to now
		if (!this.lastTick)
			this.lastTick = Date.now();

		// compute delta time
		const now = Date.now();
		const deltaTime = (now - this.lastTick) / 1000;
		this.lastTick = now;

		// Update fish spawn
		this.fishSpawnTimer -= deltaTime;
		if (this.fishSpawnTimer <= 0) {

			// pick a new spawn interval
			this.fishSpawnTimer = this.getNewFishSpawnInterval();

			// if we have less than the max fish, spawn a new one
			if (this.fish.length < this.maxFish.value) {

				// pick a random fish and set its position
				const newFish = this.getRandomFish();
				newFish.posX = Math.random() * 4;
				newFish.posY = Math.random() * 4;
				newFish.targetPosX = Math.random() * 4;
				newFish.targetPosY = Math.random() * 4;
				newFish.mode = 'wander';
				newFish.waitTimer = 0;
				newFish.nibbling = false;
				this.fish.push(newFish);
			}
		}

		// Update casts
		for (const cast of this.casts) {
			
			// if a cast times out, remove it from the lake
			cast.timer -= deltaTime;
			if (cast.timer <= 0) {
				this.log(`${cast.username}'s line reeled in automatically.`);
				this.casts = this.casts.filter(c => c !== cast);
			}

		}// next cast

		// Update fish logic
		for (const f of this.fish) {

			// move fish towards target position
			const dx = f.targetPosX - f.posX;
			const dy = f.targetPosY - f.posY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			// move fish
			if (dist > 0.1) {
				const speed = 0.2 * deltaTime;
				f.posX += (dx / dist) * speed;
				f.posY += (dy / dist) * speed;

			// otherwise, we're waiting
			} else {

				// if our wait timer is 0, pick a new target position
				if (f.waitTimer <= 0) {

					// if we're in wander or sadwander mode, pick a new target position
					if (f.mode === 'wander' || f.mode === 'sadwander') {

						// reset timer & pick new target position
						f.waitTimer = 1 + Math.random() * 3;
						f.targetPosX = Math.random() * 4;
						f.targetPosY = Math.random() * 4;
						if (f.mode === 'sadwander') {
							f.mode = 'wander';
						}

					// if we're in attract mode, just wait a bit while we nibble
					} else if (f.mode === 'attract') {
						f.waitTimer = 2 + Math.random() * 3;
						f.nibbling = true;
					}

				// otherwise, decrement the timer
				} else {

					// time down
					f.waitTimer -= deltaTime;

					// if we're in attract mode and time is up, switch to sadwander
					if (f.waitTimer <= 0 && f.mode === 'attract') {

						if(f.nibbling==false){
							f.waitTimer = 2 + Math.random() * 3;
							f.nibbling = true;
						}else {

							f.mode = 'sadwander';
							f.nibbling = false;
							f.targetPosX = Math.random() * 4;
							f.targetPosY = Math.random() * 4;
						}
					}
				}
			}

			// if we're n wander mode, check if any casts are nearby
			// this will attract us
			if (f.mode === 'wander') {

				// find casts that are near us
				const cast = this.casts.find(c => {
					const dx = c.castX - f.posX;
					const dy = c.castY - f.posY;
					return Math.sqrt(dx * dx + dy * dy) < 1;
				});

				// if we got one, move towards it!
				if (cast) {
					f.mode = 'attract';
					f.targetPosX = cast.castX;
					f.targetPosY = cast.castY;
					f.targetCast = cast;
					f.nibbling = false;
				}
			}

			// update our screen coords
			const { screenX, screenY } = this.toScreenCoords(f.posX, f.posY);
			f.screenPosX = screenX;
			f.screenPosY = screenY;

		}// next f

		// return the current state of the game
		return {
			casts: this.casts.map(c => ({ ...c })),
			fish: this.fish.map(f => ({ ...f })),
		};
	}

}
