import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 5180,
        proxy: {
            '/api/': {
                target: 'http://localhost:8001',
                changeOrigin: true,
                timeout: 0,       // No timeout — SSE streams can take 2+ min for LLM pipeline
                proxyTimeout: 0,  // No proxy timeout
            },
        },
    },
});
