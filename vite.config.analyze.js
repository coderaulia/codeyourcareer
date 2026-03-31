import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: resolve(process.cwd(), 'reports', 'bundle-stats.html'),
      gzipSize: true,
      brotliSize: true,
      open: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        admin: resolve(process.cwd(), 'adminpanel/index.html'),
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
});