const Path = require('path');
const vuePlugin = require('@vitejs/plugin-vue');
const { defineConfig } = require('vite');

/**
 * https://vitejs.dev/config
 */
const config = defineConfig({
	// 👇 Add this alias block
	resolve: {
		alias: {
			'@components': Path.resolve(__dirname, 'src/renderer/components'),
			'@toys': Path.resolve(__dirname, 'src/renderer/toys'),
			'@scripts': Path.resolve(__dirname, 'src/renderer/scripts'),
			'@assets': Path.resolve(__dirname, 'src/renderer/assets'),
			// Cross-process catalogs (built-in asset list, etc.) shared by
			// both the renderer (imported as JSON, inlined by Vite at build
			// time) AND the main process (require'd at runtime from the
			// build/shared output, copied by scripts/build.js).
			'@shared': Path.resolve(__dirname, 'src/shared'),
		}
	},

	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern',
				silenceDeprecations: ["legacy-js-api"],
			}
		}
	},
	root: Path.join(__dirname, 'src', 'renderer'),
	publicDir: 'public',
	server: {
		port: 8080,
		fs: {
			// Default `fs.allow` is just the root (`src/renderer/`). When
			// we set this option, we REPLACE the defaults (which would
			// otherwise include node_modules via Vite's auto-detection).
			// So we have to list everything explicitly:
			//   - the whole project root so `src/shared/` resolves
			//   - node_modules for font files like material-icons.woff2
			//     and assorted library assets
			allow: [__dirname],
		},
	},
	open: false,
	build: {
		outDir: Path.join(__dirname, 'build', 'renderer'),
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: Path.join(__dirname, 'src', 'renderer', 'index.html'),
				live: Path.join(__dirname, 'src', 'renderer', 'live.html'),
				test: Path.join(__dirname, 'src', 'renderer', 'obsTestPage.html'),
				queueManager: Path.join(__dirname, 'src', 'renderer', 'queue-manager.html'),
			},
		},
	},
	plugins: [vuePlugin()],

});

module.exports = config;
