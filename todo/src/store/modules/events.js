import {GoogleSheetDB, ORM, Table} from "../../../../dnd/static/js/db/google.js";

const LOCAL_STORAGE_KEY = "events-list";

const saveEvents = (hero) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hero));
};

const loadEvents = () => {
    const data =  localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const state = {
    events: loadEvents()
};

export const getters = {
    getEvents: state => state.events,
};

export const mutations = {
    SET_EVENTS(state, events) {
        state.events = events;
        saveEvents(state.events);
    },
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
        list: "real_life_hero"
    });
}

export const actions = {
    async initHero({ commit, rootGetters }) {
        const table = await getGoogleSheetTable(rootGetters);
        if (!table) {
            commit("SET_HERO", loadHero());
            return;
        }

        const list = await table.getAll({caching:5});
        const orm = new ORM(table.columns[table.list]);
        let hero = {};
        list.map(e => {
            let formated = orm.getFormated(e)
            hero[formated.code] = formated.value;
        });
        commit("SET_HERO", hero);
    },

    async setEvents({ commit, rootGetters }, events) {
        commit("SET_EVENTS", events);
    }
};
