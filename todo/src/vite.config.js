import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        Components({
            resolvers: [ElementPlusResolver()],
            dirs: ['src'],
            dts: false
        })
    ],
    define: {
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false // чтобы убрать предупреждение
    },
    base: "",
    resolve: {
        alias: {
            '@': resolve(__dirname, './') // ← если vite.config.js внутри src
            // если vite.config.js в корне проекта, то './src'
        }
    },
    build: {
        minify: 'esbuild',
        sourcemap: true,
        // Папка выше относительно src => это ../
        outDir: resolve(__dirname, '../'),
        emptyOutDir: false, // очищает папку перед сборкой (по умолчанию true только если outDir внутри проекта)
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    // Точный матчинг по имени пакета, чтобы не поймать лишнее (например, @element-plus/icons-vue по подстроке 'vue')
                    const m = id.match(/node_modules[/\\]([^/\\]+)/);
                    const pkg = m ? m[1] : '';
                    // Скоуп-пакеты: первый сегмент — имя скоупа (@vue, @vueuse)
                    if (pkg === 'vue' || pkg === '@vue' || pkg === 'vue-demi' || pkg === 'vue-router' || pkg === 'vuex' || pkg === '@vueuse') return 'vue';
                    // Всё остальное из node_modules — в один чанк, чтобы не плодить циклические импорты между чанками (TDZ-ошибки)
                    return 'element-plus';
                }
            }
        }
    }
})
