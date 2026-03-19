import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    mode === 'analyze' &&
      visualizer({
        filename: resolve(__dirname, 'reports', 'bundle-stats.html'),
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'adminpanel/index.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('animejs')) {
            return 'anime';
          }

          return 'vendor';
        },
      },
    },
  },
}));
