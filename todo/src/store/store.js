import { createStore } from 'vuex'
import * as todos from '@/store/modules/todos.js'  // твой модуль для задач
import * as hero from '@/store/modules/hero.js'  // новый модуль для настроек
import * as events from '@/store/modules/events.js'  // новый модуль для настроек
import * as settings from '@/store/modules/settings.js'  // новый модуль для настроек

export default createStore({
    modules: {
        todos: { ...todos, namespaced: true },
        hero: { ...hero, namespaced: true },
        events: { ...events, namespaced: true },
        settings: { ...settings, namespaced: true }
    }
})
