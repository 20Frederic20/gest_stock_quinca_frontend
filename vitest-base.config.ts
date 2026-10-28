import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Merged by `ng test` into its own Vitest configuration (angular.json: "runnerConfig": true).
//
// @zxing/library only declares "main" (CommonJS) for Node, while @zxing/ngx-scanner imports it
// with ES named exports: Node refuses that, and every spec touching the barcode scanner failed
// to load. Point it at the library's own ES build, transformed by Vite rather than Node.
export default defineConfig({
  resolve: {
    alias: {
      '@zxing/library': fileURLToPath(new URL('./node_modules/@zxing/library/esm/index.js', import.meta.url)),
    },
  },
  test: {
    server: {
      deps: {
        inline: [/@zxing\//],
      },
    },
  },
});
