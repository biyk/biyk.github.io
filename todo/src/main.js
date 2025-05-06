import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import router from './router'
import store from './store/store.js'

createApp(App)
    .use(router)
    .use(store)
    .use(ElementPlus)
    .mount('#app')
