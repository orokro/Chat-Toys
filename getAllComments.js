/*
	getAllComments.js
	-----------------

	This script scans all JavaScript and Vue files in the current directory and its subdirectories,
	and extracts all comments, including single-line, multi-line, and HTML-style comments.
*/

// imports
const fs = require('fs');
const path = require('path');

// Folders to ignore
const IGNORE_DIRS = ['node_modules', 'dist', 'build', 'misc', 'plugin', 'old_vite_cgs'];

// Regex to match all desired comment formats
const COMMENT_REGEX = /(?:\/\/.*?$)|(?:\/\*[\s\S]*?\*\/)|(?:<!--[\s\S]*?-->)/gm;

// File extensions to scan
const VALID_EXTENSIONS = ['.js', '.vue'];

/**
 * Recursively walk directory, skipping ignored ones
 */
function walk(dir, callback) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.includes(entry.name)) {
                walk(fullPath, callback);
            }
        } else {
            callback(fullPath);
        }
    }
}


/**
 * Extract comments from a string using regex
 */
function extractCommentsFromContent(content) {
    const matches = content.match(COMMENT_REGEX);
    return matches ? matches.join('\n') : '';
}


/**
 * Check if the file is a valid JS or Vue file
 * 
 * @param file 0 - file path
 * @returns {boolean} true if the file is a valid JS or Vue file
 */
function isValidFile(file) {
    return VALID_EXTENSIONS.includes(path.extname(file));
}

// Main logic
(function main() {
    const projectRoot = process.cwd();
    let allComments = [];

    walk(projectRoot, (filePath) => {
        if (isValidFile(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const comments = extractCommentsFromContent(content);
                if (comments) {
                    allComments.push(`// From: ${filePath}\n${comments}\n`);
                }
            } catch (err) {
                // Fail silently
            }
        }
    });

    console.log(allComments.join('\n'));
})();
