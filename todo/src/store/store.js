import { createStore } from 'vuex'
import * as todos from '@/store/modules/todos.js'  // твой модуль для задач
import * as settings from '@/store/modules/settings.js'  // новый модуль для настроек

export default createStore({
    modules: {
        todos: { ...todos, namespaced: true },
        settings: { ...settings, namespaced: true }
    }
})
