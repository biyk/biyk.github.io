const LOCAL_STORAGE_KEY = "todo-settings";

async function saveToStorage(todos) {
    await localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
}

function loadFromStorage() {
    const data =  localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}


export const state = {
    settings: loadFromStorage(),  // Массив настроек
    calc: {}
}

export const getters = {
    allSettings: (state) => state.settings,  // Получить все настройки
    allCalc: (state) => state.calc
}

export const mutations = {
    async SET_SETTINGS(state, setting) {
        state.settings.push(setting)  // Добавляем новую настройку в массив
        await saveToStorage(state.settings)
    },
    async DELETE_SETTING(state, index) {
        state.settings.splice(index, 1)  // Удаляем настройку по индексу
        await saveToStorage(state.settings)
    },
    async CALC_SETTING(state, settings) {
        state.calc = settings;
    },
}

export const actions = {
    saveSettings({ commit }, setting) {
        commit('SET_SETTINGS', setting)  // Вызываем мутацию для сохранения
    },
    deleteSetting({ commit }, index) {
        commit('DELETE_SETTING', index)  // Вызываем мутацию для удаления
    },
    calcSettings({ commit }, settings) {
        commit('CALC_SETTING', settings)  // Вызываем мутацию для удаления
    },

}
