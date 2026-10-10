import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts', 'eval/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    environment: 'node',
  },
});
