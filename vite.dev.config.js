// vite.test.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
	plugins: [vue()],
	root: './dev', // Dev environment root
	publicDir: resolve(__dirname, 'public'), // Explicitly set public folder
	server: {
		port: 5174, // Custom dev port
	},
	build: {
		outDir: '../dist-dev', // Separate build output
	},
})
