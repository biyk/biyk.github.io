import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue()
    ],
    base: "",
    resolve: {
        alias: {
            '@': resolve(__dirname, './') // ← если vite.config.js внутри src
            // если vite.config.js в корне проекта, то './src'
        }
    },
    build: {
        minify: false,
        // Папка выше относительно src => это ../
        outDir: resolve(__dirname, '../'),
        emptyOutDir: false, // очищает папку перед сборкой (по умолчанию true только если outDir внутри проекта)
    }
})
