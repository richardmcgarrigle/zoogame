import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  plugins: [
    {
      name: 'mock-static-assets',
      resolveId(id) {
        if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(id)) {
          return '\0virtual:asset';
        }
      },
      load(id) {
        if (id === '\0virtual:asset') {
          return 'export default "mock-asset-url"';
        }
      },
    },
  ],
});
