/*
	vite.config.js
	--------------

	Configuration file for Vite. This file is used to configure Vite's build process.
	For more information, see the Vite documentation: https://vitejs.dev/config/
*/

// Import the defineConfig function from Vite.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import copy from 'rollup-plugin-copy'

// Export a configuration object.
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

				// Define multiple entry points for your HTML files.
				popup: resolve(__dirname, 'src/stream_stage_popup.html'),
				options: resolve(__dirname, 'src/options.html')
			},

			plugins: [

				// Copy static files (background, content scripts, manifest, styles, icons) directly to the build output.
				copy({
					targets: [
						{ src: 'src/manifest.json', dest: 'dist/chrome' },
						{ src: 'src/background.js', dest: 'dist/chrome' },
						{ src: 'src/chat_content_script.js', dest: 'dist/chrome' },
						{ src: 'src/styles.css', dest: 'dist/chrome' },
						{ src: 'src/icons', dest: 'dist/chrome' }
					],
					hook: 'writeBundle'
				})

			]// plugins

		}// rollupOptions

	}// build

});

