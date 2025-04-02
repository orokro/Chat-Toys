/*
	database.js
	-----------

	This file will handle the database connection and schema setup for the app.
*/

// Node Modules
const path = require("path");
const { app } = require("electron");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

/**
 * Class for managing the database connection and schema.
 */
class DatabaseManager {

	/**
	 * Builds the DatabaseManager object
	 * 
	 * @param {string} dbPath - The path to the database file
	 * @returns {DatabaseManager} The DatabaseManager object
	 */
	constructor(dbPath) {

		// save our db path & initialize the database
		this.dbPath = dbPath;
		this.db = new Database(dbPath);

		// set up the schema
		this.setupSchema();
	}


	/**
	 * Sets up the schema for the database
	 */
	setupSchema() {

		// helper method to make the code below more readable
		const run = (sql) => this.db.prepare(sql).run();

		// USERS
		run(`
			CREATE TABLE IF NOT EXISTS users (
				youtube_id TEXT PRIMARY KEY,
				display_name TEXT,
				points INTEGER DEFAULT 0,
				points_spent INTEGER DEFAULT 0,
				first_seen TEXT,
				last_seen TEXT,
				banned INTEGER DEFAULT 0
			)
		`);

		// STREAMS
		run(`
			CREATE TABLE IF NOT EXISTS streams (
				id TEXT PRIMARY KEY
			)
		`);

		// COMMANDS
		run(`
			CREATE TABLE IF NOT EXISTS commands (
				name TEXT PRIMARY KEY,
				usage_count INTEGER DEFAULT 1
			)
		`);

		// USER_COMMANDS (many-to-many)
		run(`
			CREATE TABLE IF NOT EXISTS user_commands (
				youtube_id TEXT,
				command_name TEXT,
				usage_count INTEGER DEFAULT 1,
				PRIMARY KEY (youtube_id, command_name),
				FOREIGN KEY (youtube_id) REFERENCES users(youtube_id),
				FOREIGN KEY (command_name) REFERENCES commands(name)
			)
		`);

		// USER_STREAMS (many-to-many)
		run(`
			CREATE TABLE IF NOT EXISTS user_streams (
				youtube_id TEXT,
				stream_id TEXT,
				PRIMARY KEY (youtube_id, stream_id),
				FOREIGN KEY (youtube_id) REFERENCES users(youtube_id),
				FOREIGN KEY (stream_id) REFERENCES streams(id)
			)
		`);

		// ASSETS
		run(`
			CREATE TABLE IF NOT EXISTS assets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT,
				file_name TEXT,
				file_path TEXT,
				type TEXT,
				tags TEXT,
				internal INTEGER DEFAULT 0
			)
		`);
	}


	/**
	 * Get's a chat user's basic info from the database
	 * 
	 * @param {String} youtube_id - the channel id for a YouTuber user
	 * @returns {Object} - the user object from the database
	 */
	getUser(youtube_id) {
		return this.db
			.prepare(`SELECT youtube_id, display_name, points, banned FROM users WHERE youtube_id = ?`)
			.get(youtube_id);
	}



	/**
	 * Method to get a list of users from the database
	 * 
	 * @param {Array<String>} youtube_ids - list of user ids to get
	 * @returns {Array<Object>} - list of user objects from the database
	 */
	getUsers(youtube_ids) {
		const placeholders = youtube_ids.map(() => "?").join(",");
		return this.db
			.prepare(`SELECT youtube_id, display_name, points, banned FROM users WHERE youtube_id IN (${placeholders})`)
			.all(...youtube_ids);
	}


	/**
	 * Get's a chat user's full info from the database
	 * 
	 * @param {String} youtube_id - the channel id for a YouTuber user
	 * @returns {Object} - the user object from the database
	 */
	getUserFull(youtube_id) {
		const user = this.db.prepare(`SELECT * FROM users WHERE youtube_id = ?`).get(youtube_id);
		if (!user) return null;

		const streams = this.db
			.prepare(`SELECT stream_id FROM user_streams WHERE youtube_id = ?`)
			.all(youtube_id)
			.map((row) => row.stream_id);

		const commands = this.db
			.prepare(`SELECT command_name, usage_count FROM user_commands WHERE youtube_id = ?`)
			.all(youtube_id)
			.map((row) => `${row.command_name}:${row.usage_count}`);

		return {
			...user,
			streams,
			commands
		};
	}


	/**
	 * Get a user by display name (basic info)
	 * 
	 * @param {String} display_name - The display name of the user
	 * @returns {Object|null}
	 */
	getUserByDisplayName(display_name) {
		return this.db
			.prepare(`SELECT youtube_id, display_name, points, banned FROM users WHERE display_name = ? COLLATE NOCASE`)
			.get(display_name);
	}
	

	/**
	 * Get a user by display name (full info)
	 * 
	 * @param {String} display_name - The display name of the user
	 * @returns {Object|null}
	 */
	getUserFullByDisplayName(display_name) {
		const user = this.db
			.prepare(`SELECT * FROM users WHERE display_name = ? COLLATE NOCASE`)
			.get(display_name);
		if (!user) return null;
	
		const streams = this.db
			.prepare(`SELECT stream_id FROM user_streams WHERE youtube_id = ?`)
			.all(user.youtube_id)
			.map(row => row.stream_id);
	
		const commands = this.db
			.prepare(`SELECT command_name, usage_count FROM user_commands WHERE youtube_id = ?`)
			.all(user.youtube_id)
			.map(row => `${row.command_name}:${row.usage_count}`);
	
		return {
			...user,
			streams,
			commands
		};
	}


	/**
	 * Updates a user's data in the database
	 * 
	 * @param {String} youtube_id - the channel id for a YouTuber user
	 * @param {Object} param1 - the (optional) user data to update
	 */
	updateUser(youtube_id, { displayName, streamID, command, relativePoints } = {}) {


		const now = new Date().toISOString();

		// optional youtube ID if none is provided
		if (!youtube_id) {
			youtube_id = `fake-${uuidv4()}`;
		}

		const userExists = this.db.prepare(`SELECT 1 FROM users WHERE youtube_id = ?`).get(youtube_id);
		const insertUser = this.db.prepare(`
			INSERT INTO users (youtube_id, display_name, first_seen, last_seen)
			VALUES (?, ?, ?, ?)
		`);
		const updateSeen = this.db.prepare(`UPDATE users SET last_seen = ? WHERE youtube_id = ?`);
		const updateName = this.db.prepare(`UPDATE users SET display_name = ? WHERE youtube_id = ?`);

		const updatePoints = this.db.prepare(`
			UPDATE users SET points = points + ?, points_spent = points_spent + ? WHERE youtube_id = ?
		`);

		const insertStream = this.db.prepare(`INSERT OR IGNORE INTO streams (id) VALUES (?)`);
		const linkUserStream = this.db.prepare(`
      		INSERT OR IGNORE INTO user_streams (youtube_id, stream_id) VALUES (?, ?)
		`);

		const insertCommand = this.db.prepare(`
			INSERT INTO commands (name) VALUES (?)
			ON CONFLICT(name) DO UPDATE SET usage_count = usage_count + 1
		`);

		const linkUserCommand = this.db.prepare(`
			INSERT INTO user_commands (youtube_id, command_name)
			VALUES (?, ?)
			ON CONFLICT(youtube_id, command_name)
			DO UPDATE SET usage_count = usage_count + 1
		`);

		// since we have optional parameters, we'll try everything in this transaction
		const tx = this.db.transaction(() => {

			// if the user doesn't exist, create them
			if (!userExists) {
				insertUser.run(youtube_id, displayName || youtube_id, now, now);
			} else {
				updateSeen.run(now, youtube_id);
				if (displayName) updateName.run(displayName, youtube_id);
			}

			// if we have a stream ID, add it to the user
			if (streamID) {
				insertStream.run(streamID);
				linkUserStream.run(youtube_id, streamID);
			}

			// if we have a command, add it to the user
			if (command) {
				insertCommand.run(command);
				linkUserCommand.run(youtube_id, command);
			}

			// if we have points to update, do it
			// this will also increase the points_spent if the points are negative
			if (relativePoints !== undefined) {
				const spent = relativePoints < 0 ? Math.abs(relativePoints) : 0;
				const gain = relativePoints;
				updatePoints.run(gain, spent, youtube_id);
			}
		});

		// run the transaction
		tx();
	}

	/**
	 * Bans a user from the system
	 * 
	 * @param {String} youtube_id - the channel id for a YouTuber user
	 */
	ban(youtube_id) {
		this.db.prepare(`UPDATE users SET banned = 1 WHERE youtube_id = ?`).run(youtube_id);
	}


	/**
	 * Unbans a user from the system
	 * 
	 * @param {String} youtube_id - the channel id for a YouTuber user
	 */
	unBan(youtube_id) {
		this.db.prepare(`UPDATE users SET banned = 0 WHERE youtube_id = ?`).run(youtube_id);
	}
}

// Export the DatabaseManager class
module.exports = {
	DatabaseManager
};
