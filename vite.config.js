/*
	vite.config.js
	--------------
	Configuration file for Vite. This file is used to configure Vite's build process.
	For more information, see the Vite documentation: https://vitejs.dev/config/
*/

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import copy from 'rollup-plugin-copy'

export default defineConfig({
	plugins: [
		vue()
	],

	// Use a relative base path so that built assets resolve correctly in the Chrome extension.
	base: './',

	build: {
		outDir: 'dist/chrome',
		rollupOptions: {
			input: {
				// Define multiple entry points for your HTML pages and your bundled content script.
				popup: resolve(__dirname, 'src/stream_stage_popup.html'),
				options: resolve(__dirname, 'src/options.html'),
				chat_content_script: resolve(__dirname, 'src/chat_content_script.js'),
				background: resolve(__dirname, 'src/background.js'),
			},
			output: {
				// Ensure the file names remain predictable (matching what's in your manifest.json).
				entryFileNames: '[name].js'
			},
			plugins: [
				// Copy static files (background, manifest, styles, icons) directly to the build output.
				copy({
					targets: [
						{ src: 'src/manifest.json', dest: 'dist/chrome' },
						// { src: 'src/background.js', dest: 'dist/chrome' },
						// Removed chat_content_script.js since it is now bundled.
						{ src: 'src/styles.css', dest: 'dist/chrome' },
						{ src: 'src/icons', dest: 'dist/chrome' }
					],
					hook: 'writeBundle'
				})
			]
		}
	}
});
