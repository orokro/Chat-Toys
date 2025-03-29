const path = require("path");
const { app } = require("electron");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

class DatabaseManager {

	constructor(dbPath) {

		this.dbPath = dbPath;
		this.db = new Database(dbPath);
		this.setupSchema();
	}

	setupSchema() {
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

	getUser(youtube_id) {
		return this.db
			.prepare(`SELECT youtube_id, display_name, points, banned FROM users WHERE youtube_id = ?`)
			.get(youtube_id);
	}

	getUsers(youtube_ids) {
		const placeholders = youtube_ids.map(() => "?").join(",");
		return this.db
			.prepare(`SELECT youtube_id, display_name, points, banned FROM users WHERE youtube_id IN (${placeholders})`)
			.all(...youtube_ids);
	}

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

	updateUser(youtube_id, { displayName, streamID, command, relativePoints } = {}) {
		const now = new Date().toISOString();

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

		const tx = this.db.transaction(() => {
			if (!userExists) {
				insertUser.run(youtube_id, displayName || youtube_id, now, now);
			} else {
				updateSeen.run(now, youtube_id);
				if (displayName) updateName.run(displayName, youtube_id);
			}

			if (streamID) {
				insertStream.run(streamID);
				linkUserStream.run(youtube_id, streamID);
			}

			if (command) {
				insertCommand.run(command);
				linkUserCommand.run(youtube_id, command);
			}

			if (relativePoints !== undefined) {
				const spent = relativePoints < 0 ? Math.abs(relativePoints) : 0;
				const gain = relativePoints;
				updatePoints.run(gain, spent, youtube_id);
			}
		});

		tx();
	}

	ban(youtube_id) {
		this.db.prepare(`UPDATE users SET banned = 1 WHERE youtube_id = ?`).run(youtube_id);
	}

	unBan(youtube_id) {
		this.db.prepare(`UPDATE users SET banned = 0 WHERE youtube_id = ?`).run(youtube_id);
	}
}

module.exports = {
	DatabaseManager
};
