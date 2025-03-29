const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { randomUUID } = require('crypto');

const dbPath = path.join(app.getPath('userData'), 'ytct_data.db');
const db = new Database(dbPath);

function initSchema() {
	db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      youtube_id TEXT PRIMARY KEY,
      display_name TEXT,
      points INTEGER DEFAULT 0,
      points_spent INTEGER DEFAULT 0,
      first_seen TEXT,
      last_seen TEXT,
      banned INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS streams (
      video_id TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS commands (
      command TEXT PRIMARY KEY,
      usage_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_streams (
      youtube_id TEXT,
      video_id TEXT,
      PRIMARY KEY (youtube_id, video_id),
      FOREIGN KEY (youtube_id) REFERENCES users(youtube_id),
      FOREIGN KEY (video_id) REFERENCES streams(video_id)
    );

    CREATE TABLE IF NOT EXISTS user_commands (
      youtube_id TEXT,
      command TEXT,
      count INTEGER DEFAULT 1,
      PRIMARY KEY (youtube_id, command),
      FOREIGN KEY (youtube_id) REFERENCES users(youtube_id),
      FOREIGN KEY (command) REFERENCES commands(command)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      file_name TEXT,
      file_path TEXT,
      type TEXT,
      tags TEXT,
      internal INTEGER DEFAULT 0
    );
  `);
}

initSchema();

class DatabaseManager {
	getUser(id) {
		return db.prepare(`
      SELECT youtube_id, display_name, points, points_spent, banned
      FROM users
      WHERE youtube_id = ?
    `).get(id);
	}

	getUsers(ids) {
		const placeholders = ids.map(() => '?').join(',');
		return db.prepare(`
      SELECT youtube_id, display_name, points, points_spent, banned
      FROM users
      WHERE youtube_id IN (${placeholders})
    `).all(...ids);
	}

	getUserFull(id) {
		const user = db.prepare(`
      SELECT * FROM users WHERE youtube_id = ?
    `).get(id);

		if (!user) return null;

		const streamRows = db.prepare(`
      SELECT video_id FROM user_streams WHERE youtube_id = ?
    `).all(id);

		const commandRows = db.prepare(`
      SELECT command, count FROM user_commands WHERE youtube_id = ?
    `).all(id);

		return {
			...user,
			streams: streamRows.map(r => r.video_id).join(','),
			commands: commandRows.map(r => `${r.command}:${r.count}`).join(',')
		};
	}

	updateUser(id, { displayName, streamID, command, relativePoints } = {}) {
		if (!id) throw new Error("User ID is required");

		// Auto-create ID if needed (for fake users)
		if (id === 'FAKE') id = 'debug_' + randomUUID();

		const now = Date.now();

		// Check if user exists
		const user = db.prepare(`SELECT * FROM users WHERE youtube_id = ?`).get(id);

		if (!user) {
			db.prepare(`
        INSERT INTO users (youtube_id, display_name, points, points_spent, first_seen, last_seen)
        VALUES (?, ?, 0, 0, ?, ?)
      `).run(id, displayName || id, `${now}:${streamID || ''}`, `${now}:${streamID || ''}`);
		} else {
			// Update name if it's been over 24h
			const lastSeenTime = parseInt((user.last_seen || '').split(':')[0] || 0);
			if (displayName && now - lastSeenTime > 24 * 60 * 60 * 1000) {
				db.prepare(`UPDATE users SET display_name = ? WHERE youtube_id = ?`).run(displayName, id);
			}

			// Update last seen
			if (streamID) {
				db.prepare(`UPDATE users SET last_seen = ? WHERE youtube_id = ?`).run(`${now}:${streamID}`, id);
			}
		}

		// Points update
		if (typeof relativePoints === 'number') {
			db.prepare(`
        UPDATE users
        SET points = points + ?,
            points_spent = points_spent + CASE WHEN ? < 0 THEN ABS(?) ELSE 0 END
        WHERE youtube_id = ?
      `).run(relativePoints, relativePoints, relativePoints, id);
		}

		// Stream tracking
		if (streamID) {
			db.prepare(`INSERT OR IGNORE INTO streams (video_id) VALUES (?)`).run(streamID);
			db.prepare(`INSERT OR IGNORE INTO user_streams (youtube_id, video_id) VALUES (?, ?)`).run(id, streamID);
		}

		// Command tracking
		if (command) {
			db.prepare(`INSERT OR IGNORE INTO commands (command) VALUES (?)`).run(command);
			db.prepare(`UPDATE commands SET usage_count = usage_count + 1 WHERE command = ?`).run(command);

			const existingCmd = db.prepare(`SELECT count FROM user_commands WHERE youtube_id = ? AND command = ?`).get(id, command);
			if (existingCmd) {
				db.prepare(`UPDATE user_commands SET count = count + 1 WHERE youtube_id = ? AND command = ?`).run(id, command);
			} else {
				db.prepare(`INSERT INTO user_commands (youtube_id, command, count) VALUES (?, ?, 1)`).run(id, command);
			}
		}
	}

	ban(id) {
		db.prepare(`UPDATE users SET banned = 1 WHERE youtube_id = ?`).run(id);
	}

	unBan(id) {
		db.prepare(`UPDATE users SET banned = 0 WHERE youtube_id = ?`).run(id);
	}
}

module.exports = {
	DatabaseManager
};
