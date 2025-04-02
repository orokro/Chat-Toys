/*
	StateTickerQueue.js
	-------------------

	A lot of the toys will have the need to queue up state changes and then
	change them overtime based on a tick() call.

	To keep the code DRY, this class will provide a way for
	arbitrary state data to be queued up and when a timer runs out, the next
	a provided state change callback will be called, with the next state.
*/

// main class
export class StateTickerQueue {

	/**
	 * Builds the StateTickerQueue object
	 * 
	 * @param {Function} onStateChange - callback to call when a state change is needed
	 * @param {Number} defaultWait - default time to wait between state changes
	 * @param {Number} defaultDuration - default time to keep a state change
	 */
	constructor(onStateChange, defaultWait=2, defaultDuration=5) {

		// save our callback & default times
		this.onStateChange = onStateChange;
		this.defaultWait = defaultWait;
		this.defaultDuration = defaultDuration

		// the state queue
		this.queue = [];

		// true when we're in wait mode
		// (between items)
		this.waiting = false;
		
		// timer for the queue
		this.timer = 0;
	}


	/**
	 * Add a state to the queue
	 * 
	 * @param {Object} stateDetails - arbitrary state details to add to the queue
	 */
	addToQueue(stateDetails) {

		// NOTE: if stateDetails has .duration, it will be used
		// if not, the default duration will be used

		// add the state details to the queue
		this.queue.push(stateDetails);
	}


	/**
	 * decreases our timer or does nothing if the timer is already at 0
	 */
	tick(){

		// decrement the timer
		if(this.timer > 0) {
			this.timer--;

			// if times up, determine what to do next
			if(this.timer === 0) {	

				// if we're not in wait mode, wait before popping the next item
				if(this.waiting==false && this.defaultWait > 0 && this.queue.length > 0){
					this.onStateChange(null);
					this.waiting = true;
					this.timer = this.defaultWait;
					return;
				}
				
				this.popQueue();
			}

		// if time was already 0, but we have items in the queue, pop the next item
		}else if(this.queue.length > 0){
			this.popQueue();
		}else{
			this.waiting = false;
		}

	}


	/**
	 * Pops the next state from the queue
	 */
	popQueue(){

		// never waiting anymore when we pop
		this.waiting = false;

		// if the queue is empty, call our callback with null & gtfo
		// (we can leave time at 0)
		if(this.queue.length == 0){
			this.timer = 0;			
			this.onStateChange(null);
			return;
		}

		// get the next state details
		const stateDetails = this.queue.shift();

		// if the state details has a duration, use it, otherwise use the default
		this.timer = stateDetails.duration || this.defaultDuration;

		// call the callback with the state details
		this.onStateChange(stateDetails);
	}

}