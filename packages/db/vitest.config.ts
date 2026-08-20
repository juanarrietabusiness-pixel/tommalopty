import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Los tests de RLS abren transacciones contra la misma base: en serie.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
