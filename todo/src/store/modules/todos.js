import {GoogleSheetDB, ORM, Table} from "../../../../dnd/static/js/db/google.js";

const LOCAL_STORAGE_KEY = "todo-list";

const saveTodos = (todos) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
};

const loadTodos = () => {
    const data =  localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const state = {
    todos: loadTodos()
};

export const getters = {
    getTodos: state => state.todos,
};

export const mutations = {
    UPDATE_TODO(state, updatedTask) {
        const index = state.todos.findIndex(t => t.task_uuid === updatedTask.task_uuid);
        if (index !== -1) {
            state.todos.splice(index, 1, updatedTask);
            saveTodos(state.todos);
        }
    },

    SET_TODOS(state, todos) {
        state.todos = todos;
        saveTodos(state.todos);
    },
    ADD_TODO(state, payload) {
        const newTask = {
            id: payload.newId,
            task: payload.task,
            completed: false,
        };
        state.todos.unshift(newTask);
        saveTodos(state.todos);
    },
    TOGGLE_TODO(state, payload) {
        const item = state.todos.find(todo => todo.id === payload);
        if (item) {
            item.completed = !item.completed;
            saveTodos(state.todos);
        } else {
            console.error("Todo not found with id:", payload);
        }
    },
    DELETE_TODO(state, payload) {
        const index = state.todos.findIndex(todo => todo.id === payload);
        if (index !== -1) {
            state.todos.splice(index, 1);
            saveTodos(state.todos);
        } else {
            console.error("Todo not found with id:", payload);
        }
    }
};

async function getGoogleSheetTable(rootGetters) {
        const settings = rootGetters["settings/allSettings"];
        const spreadsheetSetting = settings.find(s => s.code === "spreadsheetId");
        if (!spreadsheetSetting) {
            console.warn("spreadsheetId not found in settings");
        return null;
        }

    const api = window.GoogleSheetDB || new GoogleSheetDB();
        await api.waitGoogle();

    return new Table({
            spreadsheetId: spreadsheetSetting.value,
        list: "real_life_tasks"
        });
}

export const actions = {
    async initTodos({ commit, rootGetters }) {
        const table = await getGoogleSheetTable(rootGetters);
        if (!table) {
            commit("SET_TODOS", loadTodos());
            return;
        }

        const list = await table.getAll();
        const orm = new ORM(table.columns["real_life_tasks"]);
        const todos = list.map(e => orm.getFormated(e));

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
    async updateTodo({ commit, rootGetters }, updatedTask) {
        commit("UPDATE_TODO", updatedTask);

        const table = await getGoogleSheetTable(rootGetters);
        if (!table) return;

        await table.updateRowByCode(updatedTask.task_title, updatedTask);
    }

};
