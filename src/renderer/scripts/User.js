/*
	User.js
	-------

	Helper class to communicate with the Users database.
*/

export class User {

	/**
	 * Makes a new User object
	 * 
	 * @param {Object} userData - data from the database
	 */
	constructor(userData){

		// spread the data into the class
		Object.assign(this, userData);

	}

	static fromId(id){
		
		// first attempt to get the user from the database
		const user = window.ytctDB.getUserFull(id);

		// if it doesn't exist, add the user to the database with a default name
		

	}

}
