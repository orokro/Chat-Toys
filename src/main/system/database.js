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

// Shared catalog of bundled built-in assets. Single source of truth for
// both the renderer's AssetManager AND this file's asset_paths seeding.
// `require` works because it's a JSON file - no Vue / Vite involvement.
const builtInAssets = require(path.join(__dirname, "..", "..", "shared", "builtInAssets.json"));

// Schema version pragma. Increment when adding a new schema migration
// that needs to run conditionally. Lives in SQLite's PRAGMA user_version.
//   1 -> initial asset_paths virtualization
//   2 -> fix-up malformed `assets:///<name>` paths (3 slashes) created by
//        the early createAssetFolder/insertAssetFile bug.
//   3 -> dedup asset_paths rows that share the same asset_ref. The v2
//        bump accidentally re-ran the full v1 seed against existing
//        databases, which inserted fresh /My Assets/<original_name>.png
//        rows even when the user had previously renamed the asset.
//        Keep the earliest-created row per asset_ref.
const ASSET_PATHS_SCHEMA_VERSION = 3;

// Virtual-storage prefix used by the vuefinder UI. Paths look like
// `assets:///Built-in/Fish/big.png`. The Express vuefinder endpoint
// peels this prefix off before doing SQL.
const ASSET_STORAGE_PREFIX = 'assets://';

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

		// set journal mode to WAL for better performance
		this.db.pragma('journal_mode = WAL');

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

		// FILES (NEW ASSETS)
		run(`
			CREATE TABLE IF NOT EXISTS custom_assets (
				id INTEGER PRIMARY KEY,
				uuid TEXT NOT NULL,
				original_name TEXT,
				extension TEXT,
				type TEXT,
				added_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`);

		// ASSET PATHS - virtual filesystem overlay for the vuefinder-powered
		// asset browser. Side-table that does NOT modify or replace
		// custom_assets (backwards-compat preserved). Folders are rows with
		// is_folder=1 and asset_ref=NULL; files are rows with is_folder=0
		// and asset_ref pointing at either a custom_assets.uuid or a
		// builtInAssets[].id (numeric, stored as text).
		//
		// path:        the full virtual path including the assets:// prefix
		//              and the basename. Primary key - uniqueness enforced.
		// parent_path: denormalized; the parent directory for fast `index`
		//              queries (vuefinder fetches "everything in this folder").
		// basename:    the leaf-name only (basename of path).
		// is_folder:   1 = directory row, 0 = file row.
		// asset_ref:   for files, the underlying asset id - either a uuid
		//              (custom) or the built-in numeric id stored as text.
		// is_internal: 1 if asset_ref points at a bundled built-in. Lets the
		//              preview endpoint decide which on-disk folder to read.
		// asset_kind:  'image' / 'sound' / '3d' / null (for folders).
		// display_name:optional override of the basename, for future rename
		//              without renaming the underlying file. NULL = use basename.
		// created_at:  audit only.
		run(`
			CREATE TABLE IF NOT EXISTS asset_paths (
				path         TEXT PRIMARY KEY,
				parent_path  TEXT NOT NULL,
				basename     TEXT NOT NULL,
				is_folder    INTEGER NOT NULL,
				asset_ref    TEXT,
				is_internal  INTEGER NOT NULL DEFAULT 0,
				asset_kind   TEXT,
				display_name TEXT,
				created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
			);
		`);
		run(`CREATE INDEX IF NOT EXISTS idx_asset_paths_parent ON asset_paths(parent_path);`);
		run(`CREATE INDEX IF NOT EXISTS idx_asset_paths_basename ON asset_paths(basename);`);
		run(`CREATE INDEX IF NOT EXISTS idx_asset_paths_ref ON asset_paths(asset_ref);`);

		// Run the asset_paths seeding migration after the table is in place.
		// Idempotent - runs the first time the schema version is below the
		// current target, then bumps `user_version` so subsequent boots
		// short-circuit.
		this.runAssetPathsMigration();
	}


	/**
	 * Seed the asset_paths virtual filesystem the first time we boot
	 * against an older database (or a brand-new one). Guarded by SQLite's
	 * `PRAGMA user_version` so re-runs are cheap no-ops.
	 *
	 * On a fresh install (or upgrade from pre-virtualization):
	 *   1. Create the canonical folder tree under /Built-in/ and /My Assets/.
	 *   2. Place each bundled built-in at its canonicalPath.
	 *   3. Walk existing custom_assets rows and stage them under /My Assets/.
	 *
	 * After this, the user can rearrange anything freely - we never
	 * auto-relocate user-moved rows on subsequent boots.
	 */
	runAssetPathsMigration() {

		// read current schema version. 0 means "no migration has run yet".
		const currentVersion = this.db.pragma('user_version', { simple: true });
		if (currentVersion >= ASSET_PATHS_SCHEMA_VERSION) return;

		console.log(`[asset_paths] running migration: v${currentVersion} -> v${ASSET_PATHS_SCHEMA_VERSION}`);

		// statements we'll use repeatedly inside the migration transaction.
		// `INSERT OR IGNORE` makes folder creation idempotent (rerun-safe).
		const insertFolder = this.db.prepare(`
			INSERT OR IGNORE INTO asset_paths
				(path, parent_path, basename, is_folder)
			VALUES (?, ?, ?, 1)
		`);
		const insertFile = this.db.prepare(`
			INSERT OR IGNORE INTO asset_paths
				(path, parent_path, basename, is_folder, asset_ref, is_internal, asset_kind)
			VALUES (?, ?, ?, 0, ?, ?, ?)
		`);

		// Whether to run the initial v1 seed at all. Critical: when a
		// later schema bump runs against a database that already has
		// v1 seeding applied, we MUST NOT re-seed - doing so created
		// duplicate /My Assets/<name>.png rows that survived the v1
		// path-prefix INSERT OR IGNORE check because the user had
		// already renamed their original file to a different basename.
		const shouldRunV1Seed = currentVersion < 1;

		const tx = this.db.transaction(() => {

			if (!shouldRunV1Seed) return; // v2/v3 bumps run only the targeted fix-ups below

			// ensure the root virtual folders exist. Order matters - parents
			// before children - so the parent_path lookup always resolves.
			ensureFolderChain(insertFolder, 'Built-in');
			ensureFolderChain(insertFolder, 'Built-in/Chat Frames');
			ensureFolderChain(insertFolder, 'Built-in/Points Icons');
			ensureFolderChain(insertFolder, 'Built-in/Wheel Frames');
			ensureFolderChain(insertFolder, 'Built-in/Fishing');
			ensureFolderChain(insertFolder, 'Built-in/Reactions');
			ensureFolderChain(insertFolder, 'Built-in/Tossables');
			ensureFolderChain(insertFolder, 'Built-in/Characters');
			ensureFolderChain(insertFolder, 'Built-in/SFX');
			ensureFolderChain(insertFolder, 'Built-in/SFX/Pops');
			ensureFolderChain(insertFolder, 'Built-in/SFX/Wooshes');
			ensureFolderChain(insertFolder, 'Built-in/SFX/Hits');
			ensureFolderChain(insertFolder, 'Built-in/SFX/Clicks');
			ensureFolderChain(insertFolder, 'Built-in/SFX/Reactions');
			ensureFolderChain(insertFolder, 'My Assets');

			// place each built-in at its canonicalPath. INSERT OR IGNORE so
			// users who somehow already have a row at the target path don't
			// get clobbered.
			// helper: only insert a row for this asset_ref if no row
			// already references it. Prevents duplicate path rows when
			// the seeding re-runs for any reason (and defends against
			// future migrations that may also touch this area).
			const alreadySeeded = (assetRef, isInternal) => {
				return !!this.db.prepare(`
					SELECT 1 FROM asset_paths
					WHERE asset_ref = ? AND is_internal = ?
				`).get(assetRef, isInternal ? 1 : 0);
			};

			for (const asset of builtInAssets) {
				if (alreadySeeded(String(asset.id), true)) continue;
				const folderPath = asset.canonicalPath;
				const filePath = joinAssetPath(folderPath, asset.name);
				// strip the `assets://` prefix to derive the segments
				ensureFolderChain(insertFolder, folderPath.slice(ASSET_STORAGE_PREFIX.length));
				insertFile.run(
					filePath,
					folderPath,
					asset.name,
					String(asset.id),
					1,
					asset.kind
				);
			}

			// stage existing user-imported assets in /My Assets/. We use the
			// original_name as the basename, falling back to the uuid if it
			// somehow isn't set. Basename collisions are resolved with a
			// numeric suffix `(2)`, `(3)`, …
			const userAssets = this.db.prepare(`SELECT uuid, original_name, type FROM custom_assets`).all();
			const myAssetsRoot = `${ASSET_STORAGE_PREFIX}My Assets`;
			for (const ua of userAssets) {
				if (alreadySeeded(ua.uuid, false)) continue;
				const desiredBase = ua.original_name || ua.uuid;
				const resolvedBase = resolveBasenameCollision(this.db, myAssetsRoot, desiredBase);
				insertFile.run(
					joinAssetPath(myAssetsRoot, resolvedBase),
					myAssetsRoot,
					resolvedBase,
					ua.uuid,
					0,
					ua.type || null
				);
			}
		});

		try {
			tx();
			this.db.pragma(`user_version = ${ASSET_PATHS_SCHEMA_VERSION}`);
			console.log('[asset_paths] migration complete');
		} catch (err) {
			console.error('[asset_paths] migration failed; rolled back:', err);
		}

		// v1 -> v2 fix-up: any path that begins with `assets:///` (three
		// slashes) was created by the broken joiner that concatenated
		// `parent + '/' + basename` for parents equal to the storage
		// prefix. Strip one slash off the front. Idempotent - once
		// fixed, no row matches the WHERE clause.
		if (currentVersion < 2) {
			this.db.prepare(`
				UPDATE asset_paths
				SET path = 'assets://' || SUBSTR(path, 11)
				WHERE path LIKE 'assets:///%'
			`).run();
			this.db.prepare(`
				UPDATE asset_paths
				SET parent_path = 'assets://' || SUBSTR(parent_path, 11)
				WHERE parent_path LIKE 'assets:///%'
			`).run();
		}

		// v2 -> v3 dedup: collapse duplicate rows that share the same
		// asset_ref. Caused by a previous version of this migration
		// re-running the v1 seed when bumping currentVersion < 2. Keep
		// the earliest-created row per asset_ref (which is typically the
		// user's intended placement - they may have renamed it, the
		// duplicate is the migration's fresh re-insert of the original
		// basename). Window functions need SQLite 3.25+ which
		// better-sqlite3 ships with comfortably.
		if (currentVersion < 3) {
			this.db.prepare(`
				DELETE FROM asset_paths
				WHERE rowid IN (
					SELECT rowid FROM (
						SELECT rowid, ROW_NUMBER() OVER (
							PARTITION BY asset_ref, is_internal
							ORDER BY created_at ASC, rowid ASC
						) AS rn
						FROM asset_paths
						WHERE asset_ref IS NOT NULL AND is_folder = 0
					)
					WHERE rn > 1
				)
			`).run();
		}
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
	 * Gets all of the users 100%
	 * 
	 * @returns {Array<Object>} - list of all users in the database
	 */
	getAllUsersFull(){
		const users = this.db.prepare(`SELECT * FROM users`).all();
		if (!users) return null;

		const allUsers = users.map((user) => {
			const streams = this.db
				.prepare(`SELECT stream_id FROM user_streams WHERE youtube_id = ?`)
				.all(user.youtube_id)
				.map((row) => row.stream_id);

			const commands = this.db
				.prepare(`SELECT command_name, usage_count FROM user_commands WHERE youtube_id = ?`)
				.all(user.youtube_id)
				.map((row) => `${row.command_name}:${row.usage_count}`);

			return {
				...user,
				streams,
				commands
			};
		});

		return allUsers;
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
	 * Gets the top users by points
	 * 
	 * @param {Number} limit - the number of users to get
	 * @returns {Array<Object>} - list of top users from the database
	 */
	getTopUsers(limit = 5) {
		return this.db
			.prepare(`
				SELECT display_name, points 
				FROM users 
				WHERE banned = 0 AND youtube_id NOT LIKE 'fake-%'
				ORDER BY points DESC 
				LIMIT ?
			`)
			.all(limit);
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
	 * Sets the points for a user
	 * 
	 * @param {String} youtube_id - the channel id for a YouTuber user
	 * @param {Number} points - the points to set
	 */
	setUserPoints(youtube_id, points) {
		this.db
			.prepare(`UPDATE users SET points = ? WHERE youtube_id = ?`)
			.run(points, youtube_id);
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


	/**
	 * Adds asset item to db
	 * 
	 * @param {Object} param0 object with properties
	 */
	addAsset({ uuid, originalName, extension, type }) {
		this.db
			.prepare(`INSERT INTO custom_assets (uuid, original_name, extension, type) VALUES (?, ?, ?, ?)`)
			.run(uuid, originalName, extension, type);
	}


	/**
	 * Gets all assets
	 * 
	 * @returns {Array} - list of all assets in the database
	 */
	getAllAssets() {
		return this.db.prepare(`SELECT * FROM custom_assets`).all();
	}


	/**
	 * Gets an asset by its UUID
	 * 
	 * @param {String} uuid - UUID of the asset to get
	 * @returns {Object|null} - the asset object or null if not found
	 */
	getAssetByID(uuid) {
		return this.db
			.prepare(`SELECT * FROM custom_assets WHERE uuid = ?`)
			.get(uuid);
	}


	/**
	 * Gets assets by type
	 * 
	 * @param {String} type - type of asset to get
	 * @returns {Array} - list of assets of the specified type
	 */
	getAssetsByType(type) {
		return this.db
			.prepare(`SELECT * FROM custom_assets WHERE type = ?`)
			.all(type);
	}


	/**
	 * Removes an asset
	 * @param {String} uuid - UUID of asset to remove
	 */
	removeAsset(uuid) {
		this.db
			.prepare(`DELETE FROM custom_assets WHERE uuid = ?`)
			.run(uuid);
	}


	// =====================================================================
	// asset_paths virtual filesystem operations (powering the vuefinder UI)
	// =====================================================================

	/**
	 * Get a single asset_paths row by exact path. Returns null if missing.
	 *
	 * @param {string} path - full virtual path (with assets:// prefix)
	 * @returns {Object|null}
	 */
	getAssetPathRow(path) {
		return this.db.prepare(`SELECT * FROM asset_paths WHERE path = ?`).get(path) || null;
	}


	/**
	 * Direct children of a folder, sorted folders-first then by basename.
	 * Used by the `?q=index` vuefinder endpoint.
	 *
	 * @param {string} parentPath - virtual path of the directory
	 * @returns {Array<Object>}
	 */
	listAssetPathChildren(parentPath) {
		return this.db.prepare(`
			SELECT * FROM asset_paths
			WHERE parent_path = ?
			ORDER BY is_folder DESC, basename COLLATE NOCASE
		`).all(parentPath);
	}


	/**
	 * Recursive search under a folder by case-insensitive substring of
	 * the basename. Used by the `?q=search` vuefinder endpoint.
	 *
	 * @param {string} rootPath - folder to scope the search to
	 * @param {string} filter   - case-insensitive substring
	 * @returns {Array<Object>}
	 */
	searchAssetPaths(rootPath, filter) {
		const term = `%${filter}%`;
		// When rootPath is the storage root (e.g. `assets://`), appending
		// `/%` to it produces `assets:///%` which doesn't match anything
		// (real rows start with two slashes, like `assets://Built-in/...`).
		// So if the rootPath is the storage prefix itself, just match
		// against the prefix; otherwise treat it as a folder and require
		// children to start with `{folder}/`.
		const prefix = (rootPath === ASSET_STORAGE_PREFIX)
			? `${rootPath}%`
			: `${rootPath}/%`;
		return this.db.prepare(`
			SELECT * FROM asset_paths
			WHERE (path LIKE ? OR path = ?)
			  AND basename LIKE ? COLLATE NOCASE
			ORDER BY is_folder DESC, path COLLATE NOCASE
			LIMIT 500
		`).all(prefix, rootPath, term);
	}


	/**
	 * Create a folder. Idempotent. Errors only if the path already exists
	 * as a file.
	 *
	 * @param {string} parentPath - virtual path of the parent folder
	 * @param {string} basename   - new folder name
	 * @returns {Object} the new (or existing) folder row
	 */
	createAssetFolder(parentPath, basename) {
		const newPath = joinAssetPath(parentPath, basename);
		const existing = this.getAssetPathRow(newPath);
		if (existing) {
			if (!existing.is_folder)
				throw new Error(`A file already exists at ${newPath}`);
			return existing;
		}
		this.db.prepare(`
			INSERT INTO asset_paths (path, parent_path, basename, is_folder)
			VALUES (?, ?, ?, 1)
		`).run(newPath, parentPath, basename);
		return this.getAssetPathRow(newPath);
	}


	/**
	 * Insert a file row pointing at an existing custom_asset (or built-in
	 * by id). Used by the upload handler after the file has been copied
	 * to userData/custom_assets and a custom_assets row has been inserted.
	 *
	 * @param {Object} params
	 * @param {string} params.parentPath
	 * @param {string} params.basename
	 * @param {string} params.assetRef   - uuid (custom) or numeric (built-in as string)
	 * @param {boolean} params.isInternal
	 * @param {string|null} params.assetKind
	 * @returns {Object} the new file row
	 */
	insertAssetFile({ parentPath, basename, assetRef, isInternal, assetKind }) {
		const resolved = this._resolveBasenameCollision(parentPath, basename);
		const newPath = joinAssetPath(parentPath, resolved);
		this.db.prepare(`
			INSERT INTO asset_paths
				(path, parent_path, basename, is_folder, asset_ref, is_internal, asset_kind)
			VALUES (?, ?, ?, 0, ?, ?, ?)
		`).run(newPath, parentPath, resolved, assetRef, isInternal ? 1 : 0, assetKind || null);
		return this.getAssetPathRow(newPath);
	}


	/**
	 * Rename a row in place. For folders, cascades the new path down to
	 * every descendant row inside a single transaction.
	 *
	 * @param {string} oldPath
	 * @param {string} newBasename
	 * @returns {Object} the renamed row
	 */
	renameAssetPath(oldPath, newBasename) {
		const row = this.getAssetPathRow(oldPath);
		if (!row) throw new Error(`No such path: ${oldPath}`);

		const parent = row.parent_path;
		const desired = this._resolveBasenameCollision(parent, newBasename, oldPath);
		const newPath = joinAssetPath(parent, desired);
		if (newPath === oldPath) return row; // nothing to do

		// Transaction so descendant cascade can't end up partially applied.
		const tx = this.db.transaction(() => {
			this.db.prepare(`UPDATE asset_paths SET path = ?, basename = ? WHERE path = ?`)
				.run(newPath, desired, oldPath);
			if (row.is_folder) {
				const oldPrefix = `${oldPath}/`;
				const newPrefix = `${newPath}/`;
				this.db.prepare(`
					UPDATE asset_paths
					SET path = ? || SUBSTR(path, ?),
					    parent_path = ? || SUBSTR(parent_path, ?)
					WHERE path LIKE ? || '%'
				`).run(newPrefix, oldPrefix.length + 1, newPrefix, oldPrefix.length + 1, oldPrefix);
			}
		});
		tx();
		return this.getAssetPathRow(newPath);
	}


	/**
	 * Move a row (or folder subtree) to a new parent. Cascading update
	 * for folder contents, same as rename.
	 *
	 * @param {string} sourcePath
	 * @param {string} destParent
	 * @returns {Object} the moved row's new record
	 */
	moveAssetPath(sourcePath, destParent) {
		const row = this.getAssetPathRow(sourcePath);
		if (!row) throw new Error(`No such path: ${sourcePath}`);
		// Storage root (`assets://`) is the implicit top-level folder and
		// has no asset_paths row of its own - treat it as a valid
		// destination explicitly. Other destinations must resolve to a
		// real folder row.
		if (destParent !== ASSET_STORAGE_PREFIX) {
			const destRow = this.getAssetPathRow(destParent);
			if (!destRow || !destRow.is_folder)
				throw new Error(`Destination is not a folder: ${destParent}`);
		}

		const resolved = this._resolveBasenameCollision(destParent, row.basename);
		const newPath = joinAssetPath(destParent, resolved);
		if (newPath === sourcePath) return row;

		const tx = this.db.transaction(() => {
			this.db.prepare(`
				UPDATE asset_paths
				SET path = ?, parent_path = ?, basename = ?
				WHERE path = ?
			`).run(newPath, destParent, resolved, sourcePath);
			if (row.is_folder) {
				const oldPrefix = `${sourcePath}/`;
				const newPrefix = `${newPath}/`;
				this.db.prepare(`
					UPDATE asset_paths
					SET path = ? || SUBSTR(path, ?),
					    parent_path = ? || SUBSTR(parent_path, ?)
					WHERE path LIKE ? || '%'
				`).run(newPrefix, oldPrefix.length + 1, newPrefix, oldPrefix.length + 1, oldPrefix);
			}
		});
		tx();
		return this.getAssetPathRow(newPath);
	}


	/**
	 * Copy a path row (and its descendants, for folders) to a new
	 * parent. For built-in file rows, just inserts new asset_paths rows
	 * pointing at the same `asset_ref` - the bundled file is shared.
	 * For user-imported files, physically duplicates the on-disk file
	 * with a fresh uuid, inserts a new custom_assets row, then a new
	 * asset_paths row at the destination.
	 *
	 * @param {string} sourcePath
	 * @param {string} destParent
	 * @param {string} customAssetsDir - userData/custom_assets path (for file dup)
	 * @returns {Object} the new top-level row at the destination
	 */
	copyAssetPath(sourcePath, destParent, customAssetsDir) {
		const row = this.getAssetPathRow(sourcePath);
		if (!row) throw new Error(`No such path: ${sourcePath}`);
		// Storage root (`assets://`) is the implicit top-level folder and
		// has no asset_paths row of its own - treat it as a valid
		// destination explicitly.
		if (destParent !== ASSET_STORAGE_PREFIX) {
			const destRow = this.getAssetPathRow(destParent);
			if (!destRow || !destRow.is_folder)
				throw new Error(`Destination is not a folder: ${destParent}`);
		}

		const fs   = require('fs');
		const path = require('path');
		const { v4: uuidv4 } = require('uuid');

		// Internal helper: copy one row into a target parent and return
		// the newly-inserted record. For folders the caller recurses on
		// descendants separately.
		const copyOne = (srcRow, parent) => {
			const baseName = this._resolveBasenameCollision(parent, srcRow.basename);
			const newPath  = joinAssetPath(parent, baseName);

			if (srcRow.is_folder) {
				this.db.prepare(`
					INSERT INTO asset_paths (path, parent_path, basename, is_folder)
					VALUES (?, ?, ?, 1)
				`).run(newPath, parent, baseName);
			} else {
				let assetRef = srcRow.asset_ref;
				if (!srcRow.is_internal && customAssetsDir && srcRow.asset_ref) {
					// physically duplicate the on-disk file with a fresh
					// uuid so the two paths don't end up sharing storage
					// (deletes would otherwise yank the file out from
					// under the surviving copy).
					const srcFile = path.join(customAssetsDir, srcRow.asset_ref);
					const ext = path.extname(srcRow.asset_ref);
					const newUuid = `${uuidv4()}${ext}`;
					const dstFile = path.join(customAssetsDir, newUuid);
					if (fs.existsSync(srcFile)) {
						fs.copyFileSync(srcFile, dstFile);
						// mirror the custom_assets row too
						const orig = this.db.prepare(`SELECT original_name, extension, type FROM custom_assets WHERE uuid = ?`).get(srcRow.asset_ref);
						if (orig) {
							this.addAsset({
								uuid: newUuid,
								originalName: orig.original_name,
								extension: orig.extension,
								type: orig.type,
							});
						}
						assetRef = newUuid;
					}
				}
				this.db.prepare(`
					INSERT INTO asset_paths
						(path, parent_path, basename, is_folder, asset_ref, is_internal, asset_kind)
					VALUES (?, ?, ?, 0, ?, ?, ?)
				`).run(newPath, parent, baseName, assetRef, srcRow.is_internal ? 1 : 0, srcRow.asset_kind);
			}
			return this.getAssetPathRow(newPath);
		};

		// Transaction so a folder copy is all-or-nothing on the DB side.
		// File copies happen outside the txn (writeFileSync) but if the
		// DB part rolls back, the orphaned files just sit in custom_assets
		// dir until cleaned up (harmless).
		const result = this.db.transaction(() => {
			const top = copyOne(row, destParent);
			if (row.is_folder) {
				// recurse children. We walk the source tree breadth-first
				// keyed by the OLD prefix and rebuild under the new one.
				const oldPrefix = `${sourcePath}/`;
				const newPrefix = `${top.path}/`;
				const descendants = this.db.prepare(`
					SELECT * FROM asset_paths
					WHERE path LIKE ?
					ORDER BY LENGTH(path) ASC
				`).all(`${sourcePath}/%`);
				for (const d of descendants) {
					const newParent = d.parent_path.replace(oldPrefix, newPrefix) === d.parent_path
						? (d.parent_path === sourcePath ? top.path : d.parent_path)
						: d.parent_path.replace(oldPrefix, newPrefix);
					// If the source parent was the source root, the new
					// parent is `top.path` directly.
					copyOne(d, newParent);
				}
			}
			return top;
		})();

		return result;
	}


	/**
	 * Delete a path row. For folders, deletes every descendant. Returns
	 * the list of asset_refs for user-imported files that were removed,
	 * so the caller can also delete those on-disk files + custom_assets
	 * rows. Built-in file rows are removed virtually only (the bundled
	 * file is untouched).
	 *
	 * @param {string} targetPath
	 * @returns {{ removedCustomUuids: string[] }}
	 */
	deleteAssetPath(targetPath) {
		const row = this.getAssetPathRow(targetPath);
		if (!row) return { removedCustomUuids: [] };

		const removedCustomUuids = [];

		const collectAndDelete = () => {
			if (row.is_folder) {
				const prefix = `${targetPath}/%`;
				const descendants = this.db.prepare(`
					SELECT asset_ref, is_internal FROM asset_paths
					WHERE path LIKE ? AND is_folder = 0
				`).all(prefix);
				for (const d of descendants) {
					if (!d.is_internal && d.asset_ref) removedCustomUuids.push(d.asset_ref);
				}
				this.db.prepare(`DELETE FROM asset_paths WHERE path LIKE ?`).run(prefix);
				this.db.prepare(`DELETE FROM asset_paths WHERE path = ?`).run(targetPath);
			} else {
				if (!row.is_internal && row.asset_ref) removedCustomUuids.push(row.asset_ref);
				this.db.prepare(`DELETE FROM asset_paths WHERE path = ?`).run(targetPath);
			}
		};

		this.db.transaction(collectAndDelete)();
		return { removedCustomUuids };
	}


	/**
	 * Count how many asset_paths rows still reference a given custom
	 * asset uuid. Used by the asset filesystem delete handler to decide
	 * whether wiping the on-disk file is safe (zero references) or
	 * unsafe (other rows still point at it, deleting would leave them
	 * dangling).
	 *
	 * @param {string} assetRef - the uuid stored in custom_assets / asset_paths
	 * @returns {number}
	 */
	countAssetPathsByRef(assetRef) {
		const row = this.db.prepare(`
			SELECT COUNT(*) AS c FROM asset_paths
			WHERE asset_ref = ? AND is_folder = 0
		`).get(assetRef);
		return (row && row.c) || 0;
	}


	/**
	 * Diagnostic: walk asset_paths rows and report ones that look
	 * broken. Used from the renderer's dev tools to spot data issues
	 * without having to open the SQLite file.
	 *
	 *   - missing_custom_asset:  asset_paths row references a uuid
	 *                            that no longer has a custom_assets row
	 *   - missing_builtin:       references a built-in id we don't ship
	 *   - orphan_custom_asset:   a custom_assets uuid is present but
	 *                            no asset_paths row references it
	 *
	 * @param {Function} builtInExists - test (id:string) => boolean
	 * @returns {{
	 *   missingCustomAsset:  Array<{path:string, asset_ref:string}>,
	 *   missingBuiltin:      Array<{path:string, asset_ref:string}>,
	 *   orphanCustomAssets:  Array<string>,
	 *   total:               number,
	 * }}
	 */
	inspectAssetPaths(builtInExists) {
		const all = this.db.prepare(`SELECT path, asset_ref, is_internal, is_folder FROM asset_paths`).all();
		const customRefs = new Set(
			this.db.prepare(`SELECT uuid FROM custom_assets`).all().map(r => r.uuid)
		);

		const missingCustomAsset = [];
		const missingBuiltin = [];
		const referencedCustom = new Set();

		for (const r of all) {
			if (r.is_folder) continue;
			if (!r.asset_ref) continue;
			if (r.is_internal) {
				if (typeof builtInExists === 'function' && !builtInExists(r.asset_ref)) {
					missingBuiltin.push({ path: r.path, asset_ref: r.asset_ref });
				}
			} else {
				if (!customRefs.has(r.asset_ref)) {
					missingCustomAsset.push({ path: r.path, asset_ref: r.asset_ref });
				} else {
					referencedCustom.add(r.asset_ref);
				}
			}
		}

		const orphanCustomAssets = [];
		for (const uuid of customRefs) {
			if (!referencedCustom.has(uuid)) orphanCustomAssets.push(uuid);
		}

		return {
			missingCustomAsset,
			missingBuiltin,
			orphanCustomAssets,
			total: all.length,
		};
	}


	/**
	 * Re-seed the canonical built-in folder layout + place any built-in
	 * that's missing from the virtual filesystem. INSERT OR IGNORE
	 * semantics throughout - never overwrites user reorganizations.
	 *
	 * Called by the "Restore Defaults" button on the Assets page.
	 */
	restoreAssetDefaultLayout() {
		const insertFolder = this.db.prepare(`
			INSERT OR IGNORE INTO asset_paths
				(path, parent_path, basename, is_folder)
			VALUES (?, ?, ?, 1)
		`);
		const insertFile = this.db.prepare(`
			INSERT OR IGNORE INTO asset_paths
				(path, parent_path, basename, is_folder, asset_ref, is_internal, asset_kind)
			VALUES (?, ?, ?, 0, ?, ?, ?)
		`);

		this.db.transaction(() => {
			// canonical folder tree
			ensureFolderChain(insertFolder, 'Built-in');
			ensureFolderChain(insertFolder, 'My Assets');
			for (const asset of builtInAssets) {
				ensureFolderChain(insertFolder, asset.canonicalPath.slice(ASSET_STORAGE_PREFIX.length));
			}
			// any missing built-ins go to their canonical folder. If a row
			// already exists for the same asset_ref elsewhere, the user
			// moved it - we don't duplicate.
			for (const asset of builtInAssets) {
				const existing = this.db.prepare(`
					SELECT 1 FROM asset_paths WHERE asset_ref = ? AND is_internal = 1
				`).get(String(asset.id));
				if (existing) continue;
				const filePath = joinAssetPath(asset.canonicalPath, asset.name);
				insertFile.run(filePath, asset.canonicalPath, asset.name, String(asset.id), 1, asset.kind);
			}
		})();
	}


	/**
	 * Internal: resolve a basename collision inside a parent by appending
	 * a numeric suffix. Returns the input unchanged when free.
	 *
	 *   foo.png            (free)            -> foo.png
	 *   foo.png            (taken)           -> foo (2).png
	 *   foo (2).png        (taken)           -> foo (3).png
	 *   folder             (folder taken)    -> folder (2)
	 *
	 * @param {string} parentPath
	 * @param {string} basename
	 * @param {string} [ignorePath] - existing path to ignore (used by rename so renaming to itself is fine)
	 * @returns {string} a free basename
	 */
	_resolveBasenameCollision(parentPath, basename, ignorePath = null) {

		const inUse = (b) => {
			const candidate = joinAssetPath(parentPath, b);
			if (ignorePath && candidate === ignorePath) return false;
			return !!this.db.prepare(`SELECT 1 FROM asset_paths WHERE path = ?`).get(candidate);
		};

		if (!inUse(basename)) return basename;

		// split into name + extension (only for files; folders have no ext)
		const dotIdx = basename.lastIndexOf('.');
		const hasExt = dotIdx > 0 && dotIdx < basename.length - 1;
		const stem = hasExt ? basename.slice(0, dotIdx) : basename;
		const ext = hasExt ? basename.slice(dotIdx) : '';

		for (let n = 2; n < 1000; n++) {
			const candidate = `${stem} (${n})${ext}`;
			if (!inUse(candidate)) return candidate;
		}
		// fallback - extreme collision; just return original (caller will fail)
		return basename;
	}


}


/**
 * Join a virtual parent path and a basename into a full child path.
 * Handles the special case where the parent IS the storage prefix
 * (e.g. `assets://`), which already ends with the authority-separator
 * slashes - appending another `/` would produce a malformed three-slash
 * path. Used everywhere we construct a child path inside the DB layer.
 *
 *   joinAssetPath('assets://', 'Foo')             -> 'assets://Foo'
 *   joinAssetPath('assets://Foo', 'Bar')          -> 'assets://Foo/Bar'
 *   joinAssetPath('assets://Foo/Bar', 'baz.png')  -> 'assets://Foo/Bar/baz.png'
 *
 * @param {string} parent
 * @param {string} basename
 * @returns {string}
 */
function joinAssetPath(parent, basename) {
	if (parent === ASSET_STORAGE_PREFIX) return `${parent}${basename}`;
	return `${parent}/${basename}`;
}


/**
 * Insert every ancestor folder for a virtual path. Path is given WITHOUT
 * the storage prefix (e.g. 'Built-in/Fish'). Each intermediate folder
 * is created via INSERT OR IGNORE so this is safe to call repeatedly.
 *
 * The root of the storage is `assets://` (no trailing slash); the first
 * folder created has parent_path = `assets://` and path = `assets://Foo`.
 *
 * @param {import('better-sqlite3').Statement} insertFolder - prepared INSERT statement
 * @param {string} pathWithoutPrefix - e.g. 'Built-in/Fish'
 */
function ensureFolderChain(insertFolder, pathWithoutPrefix) {
	const parts = pathWithoutPrefix.split('/').filter(Boolean);
	let parent = ASSET_STORAGE_PREFIX; // 'assets://'
	for (const seg of parts) {
		const full = joinAssetPath(parent, seg);
		insertFolder.run(full, parent, seg);
		parent = full;
	}
}


/**
 * Module-level helper used by the initial migration to dodge basename
 * collisions inside /My Assets/. Same logic as DatabaseManager's
 * _resolveBasenameCollision but takes a raw `db` handle so we can call
 * it before `this` is a stable reference inside the migration tx.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} parentPath
 * @param {string} basename
 * @returns {string}
 */
function resolveBasenameCollision(db, parentPath, basename) {
	const inUse = (b) => !!db.prepare(`SELECT 1 FROM asset_paths WHERE path = ?`).get(joinAssetPath(parentPath, b));
	if (!inUse(basename)) return basename;
	const dotIdx = basename.lastIndexOf('.');
	const hasExt = dotIdx > 0 && dotIdx < basename.length - 1;
	const stem = hasExt ? basename.slice(0, dotIdx) : basename;
	const ext = hasExt ? basename.slice(dotIdx) : '';
	for (let n = 2; n < 1000; n++) {
		const candidate = `${stem} (${n})${ext}`;
		if (!inUse(candidate)) return candidate;
	}
	return basename;
}

// Export the DatabaseManager class
module.exports = {
	DatabaseManager
};
