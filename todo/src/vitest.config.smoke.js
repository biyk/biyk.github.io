import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['utils/tests/smoke/**/*.test.js'],
        testTimeout: 120000,
        hookTimeout: 60000,
        singleThread: true,
    },
});
