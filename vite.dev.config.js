// vite.test.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
	plugins: [vue()],
	root: './dev', // directory where your test page lives
	server: {
		port: 5174, // a different port to avoid conflicts
	},
	build: {
		outDir: '../dist-dev', // ensure separate build output
	},
})
