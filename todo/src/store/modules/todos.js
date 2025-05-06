import {GoogleSheetDB, ORM, Table} from "../../../../dnd/static/js/db/google.js";

const LOCAL_STORAGE_KEY = "todo-list";

function saveToStorage(todos) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
}

function loadFromStorage() {
    const data =  localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

export const state = {
    todos: loadFromStorage()
};

export const getters = {
    getTodos: (state) => state.todos,
};

export const mutations = {
    SET_TODOS(state, todos) {
        state.todos = todos;
    },
    ADD_TODO(state, payload) {
        const newTask = {
            id: payload.newId,
            task: payload.task,
            completed: false,
        };
        state.todos.unshift(newTask);
        saveToStorage(state.todos);
    },
    TOGGLE_TODO(state, payload) {
        const item = state.todos.find((todo) => todo.id === payload);
        if (item) {
            item.completed = !item.completed;
            saveToStorage(state.todos);
        } else {
            console.error('Todo not found with id:', payload);
        }
    },
    DELETE_TODO(state, payload) {
        const index = state.todos.findIndex((todo) => todo.id === payload);
        if (index !== -1) {
            state.todos.splice(index, 1);
            saveToStorage(state.todos);
        } else {
            console.error('Todo not found with id:', payload);
        }
    }
};

export const actions = {
    async initTodos({ commit, rootGetters }) {
        // Получаем spreadsheetId из settings
        const settings = rootGetters["settings/allSettings"];
        const spreadsheetSetting = settings.find(s => s.code === "spreadsheetId");
        if (!spreadsheetSetting) {
            console.warn("spreadsheetId not found in settings");
            commit("SET_TODOS", loadFromStorage());
            return;
        }
        console.log(spreadsheetSetting.value)

        let api = window.GoogleSheetDB || new GoogleSheetDB();
        await api.waitGoogle();

        const table = new Table({
            spreadsheetId: spreadsheetSetting.value,
            list:'real_life_tasks'
        });
        let list = await table.getAll()
        let _todos = [];
        let orm = new ORM(table.columns['real_life_tasks'])
        list.forEach(e=>{
            _todos.push(orm.getFormated(e))
        })

        // Здесь можно загрузить что-то из Google Sheets, если надо
        // let rows = await table.getData(); // например
        // Но мы пока загружаем из localStorage
        const todos = _todos;
        commit("SET_TODOS", todos);
    },

    addTodo({ commit }, payload) {
        commit("ADD_TODO", payload);
    },
    toggleTodo({ commit }, payload) {
        commit("TOGGLE_TODO", payload);
    },
    deleteTodo({ commit }, payload) {
        commit("DELETE_TODO", payload);
    },
};
