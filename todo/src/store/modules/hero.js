import {GoogleSheetDB, ORM, Table} from "../../../../dnd/static/js/db/google.js";

const LOCAL_STORAGE_KEY = "hero-list";

const saveHero = (hero) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hero));
};

const loadHero = () => {
    const data =  localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const state = {
    hero: loadHero()
};

export const getters = {
    getHero: state => state.hero,
};

export const mutations = {
    UPDATE_HERO(state, hero) {
        state.hero = hero;
        saveHero(state.hero);
    },

    SET_HERO(state, hero) {
        state.hero = hero;
        saveHero(state.hero);
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

        const list = await table.getAll();
        const orm = new ORM(table.columns[table.list]);
        let hero = {};
        list.map(e => {
            let formated = orm.getFormated(e)
            hero[formated.code] = formated.value;
        });
        commit("SET_HERO", hero);
    },

    async updateHero({ commit, rootGetters }, hero) {
        commit("UPDATE_HERO", hero);

        const table = await getGoogleSheetTable(rootGetters);
        if (!table) return console.log('нет таблицы героя');
        await table.updateRowByCode('hero_money', {value:hero.hero_money});
    }

};
