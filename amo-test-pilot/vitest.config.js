import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['output/unit/**/*.test.{js,ts}'],
        environment: 'node',
        globals: false,
    },
});
