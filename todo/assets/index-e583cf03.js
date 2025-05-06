import { y as openBlock, z as createElementBlock, K as withDirectives, aK as vModelText, A as createBaseVNode, P as Fragment, al as renderList, C as normalizeClass, O as toDisplayString, M as createCommentVNode, bK as useRoute, bL as useRouter, bM as useStore, c as computed, t as onMounted, a6 as onBeforeUnmount, Q as createVNode, J as withCtx, aE as resolveComponent, bN as createRouter, bO as createWebHistory, bP as createStore, bG as createApp } from "./vendor-vue-1749dba0.js";
import { i as installer } from "./vendor-b885ec53.js";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations2) => {
    for (const mutation of mutations2) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity)
      fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy)
      fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous")
      fetchOpts.credentials = "omit";
    else
      fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
window.version = "0.2.38";
const TodoNew$1 = "";
function generateUUIDv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(char) {
    const rand = Math.random() * 16 | 0;
    const value = char === "x" ? rand : rand & 3 | 8;
    return value.toString(16);
  });
}
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _sfc_main$3 = {
  data() {
    return {
      task_title: "",
      task_uuid: generateUUIDv4()
    };
  },
  methods: {
    addTodo: function() {
      this.$store.dispatch("todos/addTodo", {
        task_uuid: this.newId,
        task_title: this.task_title
      });
      this.task_uuid = generateUUIDv4();
      this.task_title = "";
    }
  }
};
function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
  return openBlock(), createElementBlock("form", null, [
    withDirectives(createBaseVNode("input", {
      class: "todo-input",
      type: "text",
      placeholder: "Enter a new task",
      "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $data.task_title = $event)
    }, null, 512), [
      [vModelText, $data.task_title]
    ]),
    createBaseVNode("button", {
      onClick: _cache[1] || (_cache[1] = (...args) => $options.addTodo && $options.addTodo(...args)),
      type: "button"
    }, "+")
  ]);
}
const TodoNew = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$3]]);
const TodoList$1 = "";
const _sfc_main$2 = {
  computed: {
    todos() {
      return this.$store.getters["todos/getTodos"];
    },
    filteredTodos() {
      const now = new Date();
      const today = now.getTime();
      console.log(this.filter);
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        // Завтра
        23,
        59,
        0,
        0
        // Время: 23:59:00.000
      ).getTime();
      return this.todos.filter((todo) => {
        if (todo.task_title === "task_title")
          return false;
        const start = todo.start_date;
        switch (this.filter) {
          case "today":
            return start < today;
          case "tomorrow":
            return start > today && start < tomorrow;
          default:
            return true;
        }
      });
    }
  },
  props: {
    filter: {
      type: String,
      default: "all"
    }
  },
  methods: {
    toggleTodo(id) {
      this.$store.dispatch("todos/toggleTodo", id);
    },
    deleteTodo(id) {
      this.$store.dispatch("todos/deleteTodo", id);
    }
  },
  mounted() {
    this.$store.dispatch("todos/initTodos");
  }
};
const _hoisted_1$2 = { class: "tasks" };
const _hoisted_2$1 = ["onClick"];
const _hoisted_3$1 = ["title"];
const _hoisted_4$1 = ["onClick"];
function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
  return openBlock(), createElementBlock("ul", _hoisted_1$2, [
    (openBlock(true), createElementBlock(Fragment, null, renderList($options.filteredTodos, (todo) => {
      return openBlock(), createElementBlock("li", {
        key: todo.id,
        class: normalizeClass([{ completed: todo.completed }, "task"]),
        onClick: ($event) => $options.toggleTodo(todo.id)
      }, [
        createBaseVNode("span", {
          title: todo.task_description
        }, "(" + toDisplayString(todo.money_reward) + ") " + toDisplayString(todo.task_title), 9, _hoisted_3$1),
        createBaseVNode("span", {
          class: "delete",
          onClick: ($event) => $options.deleteTodo(todo.id)
        }, "ⓧ", 8, _hoisted_4$1)
      ], 10, _hoisted_2$1);
    }), 128))
  ]);
}
const TodoList = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$2]]);
const Settings_vue_vue_type_style_index_0_scoped_839f65da_lang = "";
const _sfc_main$1 = {
  name: "Settings",
  data() {
    return {
      showForm: false,
      code: "",
      value: ""
    };
  },
  computed: {
    // Получаем все настройки из хранилища
    settings() {
      return this.$store.state.settings.settings;
    }
  },
  methods: {
    // Сохраняем новую пару код/значение
    saveSetting() {
      const setting = {
        code: this.code.trim(),
        uid: generateUUIDv4(),
        value: this.value.trim()
      };
      if (!setting.code || !setting.value) {
        alert("Оба поля обязательны");
        return;
      }
      this.$store.dispatch("settings/saveSettings", setting);
      this.code = "";
      this.value = "";
      this.showForm = false;
    },
    // Удаляем настройку по индексу
    deleteSetting(index) {
      this.$store.dispatch("settings/deleteSetting", index);
    }
  }
};
const _hoisted_1$1 = { class: "settings" };
const _hoisted_2 = {
  key: 0,
  class: "form"
};
const _hoisted_3 = { key: 1 };
const _hoisted_4 = ["onClick"];
function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
  return openBlock(), createElementBlock("div", _hoisted_1$1, [
    _cache[5] || (_cache[5] = createBaseVNode("h2", null, "Настройки", -1)),
    createBaseVNode("button", {
      onClick: _cache[0] || (_cache[0] = ($event) => $data.showForm = !$data.showForm)
    }, toDisplayString($data.showForm ? "Отмена" : "Добавить"), 1),
    $data.showForm ? (openBlock(), createElementBlock("div", _hoisted_2, [
      withDirectives(createBaseVNode("input", {
        "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $data.code = $event),
        placeholder: "Код (code)",
        type: "text"
      }, null, 512), [
        [vModelText, $data.code]
      ]),
      withDirectives(createBaseVNode("input", {
        "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.value = $event),
        placeholder: "Значение (value)",
        type: "text"
      }, null, 512), [
        [vModelText, $data.value]
      ]),
      createBaseVNode("button", {
        onClick: _cache[3] || (_cache[3] = (...args) => $options.saveSetting && $options.saveSetting(...args))
      }, "Сохранить")
    ])) : createCommentVNode("", true),
    $options.settings.length > 0 ? (openBlock(), createElementBlock("div", _hoisted_3, [
      _cache[4] || (_cache[4] = createBaseVNode("h3", null, "Сохранённые настройки:", -1)),
      createBaseVNode("ul", null, [
        (openBlock(true), createElementBlock(Fragment, null, renderList($options.settings, (setting, index) => {
          return openBlock(), createElementBlock("li", { key: index }, [
            createBaseVNode("span", null, toDisplayString(setting.code) + ": " + toDisplayString(setting.value), 1),
            createBaseVNode("button", {
              onClick: ($event) => $options.deleteSetting(index)
            }, "Удалить", 8, _hoisted_4)
          ]);
        }), 128))
      ])
    ])) : createCommentVNode("", true)
  ]);
}
const Settings = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render$1], ["__scopeId", "data-v-839f65da"]]);
const App$1 = "";
let intervalId = null;
function startTaskAgent(store2) {
  if (intervalId)
    return;
  intervalId = setInterval(() => {
    const todos2 = store2.getters["todos/getTodos"];
    const now = new Date();
    todos2.forEach((todo) => {
      if (todo.task_finish_date) {
        if (todo.task_finish_date < now.getTime()) {
          console.log("Обрабатываем просроченную задачу:", todo.task_title);
        }
      }
    });
  }, 60 * 1e3);
}
function stopTaskAgent() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Агент] Остановлен.");
  }
}
const _imports_0 = "" + new URL("logo-03d6d6da.png", import.meta.url).href;
const _sfc_main = {
  components: {
    Settings,
    TodoNew,
    TodoList
  },
  setup() {
    const route = useRoute();
    const router2 = useRouter();
    const store2 = useStore();
    const activeTab = computed({
      get() {
        return route.query.tab || "new";
      },
      set(val) {
        router2.replace({ query: { ...route.query, tab: val } });
      }
    });
    onMounted(() => {
      startTaskAgent(store2);
    });
    onBeforeUnmount(() => {
      stopTaskAgent();
    });
    return { activeTab };
  }
};
const _hoisted_1 = { class: "container" };
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_TodoNew = resolveComponent("TodoNew");
  const _component_el_tab_pane = resolveComponent("el-tab-pane");
  const _component_TodoList = resolveComponent("TodoList");
  const _component_Settings = resolveComponent("Settings");
  const _component_el_tabs = resolveComponent("el-tabs");
  return openBlock(), createElementBlock("div", _hoisted_1, [
    _cache[2] || (_cache[2] = createBaseVNode("h1", null, "To-Do List", -1)),
    createVNode(_component_el_tabs, {
      modelValue: $setup.activeTab,
      "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.activeTab = $event)
    }, {
      default: withCtx(() => [
        createVNode(_component_el_tab_pane, {
          label: "Добавить",
          name: "new"
        }, {
          default: withCtx(() => [
            createVNode(_component_TodoNew)
          ]),
          _: 1
        }),
        createVNode(_component_el_tab_pane, {
          label: "Сегодня",
          name: "today"
        }, {
          default: withCtx(() => [
            createVNode(_component_TodoList, { filter: "today" })
          ]),
          _: 1
        }),
        createVNode(_component_el_tab_pane, {
          label: "Завтра",
          name: "tomorrow"
        }, {
          default: withCtx(() => [
            createVNode(_component_TodoList, { filter: "tomorrow" })
          ]),
          _: 1
        }),
        createVNode(_component_el_tab_pane, {
          label: "Список",
          name: "list"
        }, {
          default: withCtx(() => [
            createVNode(_component_TodoList, { filter: "all" })
          ]),
          _: 1
        }),
        createVNode(_component_el_tab_pane, {
          label: "Настройки",
          name: "settings"
        }, {
          default: withCtx(() => [
            _cache[1] || (_cache[1] = createBaseVNode("div", null, "Тут будут настройки", -1)),
            createVNode(_component_Settings)
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["modelValue"]),
    _cache[3] || (_cache[3] = createBaseVNode("img", {
      src: _imports_0,
      class: "vue-logo",
      alt: "Vue.js Logo"
    }, null, -1))
  ]);
}
const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render]]);
const routes = [
  {
    path: "/",
    name: "Home",
    component: App
  }
];
const router = createRouter({
  history: createWebHistory(),
  routes
});
class WebStorage {
  constructor(dbName = "WebStorageDB", storeName = "keyval") {
    this.dbName = dbName;
    this.storeName = storeName;
    this.metaStoreName = "meta";
    this.version = window.version || "";
    this.dbPromise = this.initDB();
  }
  async initDB() {
    const versionCode = this.versionToNumber(this.version);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, versionCode);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const storeName of db.objectStoreNames) {
          db.deleteObjectStore(storeName);
        }
        db.createObjectStore(this.storeName);
        db.createObjectStore(this.metaStoreName);
      };
      request.onsuccess = async () => {
        const db = request.result;
        try {
          await this.setMeta("app_version", this.version, db);
          resolve(db);
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  async clearAllStores(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName], "readwrite");
      const store2 = tx.objectStore(this.storeName);
      const request = store2.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async getMeta(key, db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.metaStoreName, "readonly");
      const store2 = tx.objectStore(this.metaStoreName);
      const request = store2.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
  async setMeta(key, value, db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.metaStoreName, "readwrite");
      const store2 = tx.objectStore(this.metaStoreName);
      const request = store2.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  // Остальные методы без изменений
  async setItem(key, value) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store2 = tx.objectStore(this.storeName);
      const request = store2.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async getItem(key) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store2 = tx.objectStore(this.storeName);
      const request = store2.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
  async removeItem(key) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store2 = tx.objectStore(this.storeName);
      const request = store2.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async clear() {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store2 = tx.objectStore(this.storeName);
      const request = store2.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  // Вспомогательный метод: получить все ключи (если нужно)
  async keys() {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store2 = tx.objectStore(this.storeName);
      const keys = [];
      const request = store2.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          keys.push(cursor.key);
          cursor.continue();
        } else {
          resolve(keys);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  versionToNumber(versionStr) {
    return versionStr.split(".").map((part) => part.padStart(2, "0")).join("").padEnd(7, "0").slice(0, 7) * 1;
  }
}
const API_KEY = "AIzaSyBTTqB_rSfwzuTIdF1gcQ5-U__fGzrQ_zs";
const spreadsheetId = "13zsZqGICZKQYMCcGkhgr7pzhH1z-LWFiH0LMrI6NGLM";
const CLIENT_ID = "21469279904-9vlmm4i93mg88h6qb4ocd2vvs612ai4u.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
class ORM {
  constructor(columns = []) {
    this.columns = columns;
  }
  getRaw(data = {}) {
    let result = [];
    this.columns.forEach((value, index) => {
      if (value === "value") {
        const raw = typeof data[value] === "object" ? JSON.stringify(data[value]) : data[value];
        const chunks = raw.toString().match(/.{1,49000}/g);
        result[index] = chunks[0];
        result.push(...chunks.slice(1));
      } else {
        result[index] = data[value];
      }
    });
    return result;
  }
  getFormated(data = []) {
    let result = {};
    this.columns.forEach((value, index) => {
      result[value] = data[index];
    });
    return result;
  }
}
class Table {
  constructor(options) {
    this.list = options.list;
    this.sheets = {};
    this.spreadsheetId = options.spreadsheetId || spreadsheetId;
    this.api = window.GoogleSheetDB || new GoogleSheetDB();
    this.spreadsheets = gapi.client.sheets.spreadsheets;
    this.columns = {};
    this.codes = {};
    this.sending = false;
  }
  async exist() {
    return await this.getSheetIdByName(this.list) || false;
  }
  async getSheetIdByName(sheetName) {
    if (this.sheets[sheetName])
      return this.sheets[sheetName];
    const response = await this.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });
    const sheet = response.result.sheets.find(
      (s) => s.properties.title === sheetName
    );
    const sheetId = sheet ? sheet.properties.sheetId : null;
    this.sheets[sheetName] = sheetId;
    return sheetId;
  }
  async addRawValues(values = []) {
    await this.waitSending();
    try {
      this.sending = true;
      let res = await this.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.list + "!A1:Z1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          majorDimension: "ROWS",
          values
          //values: [["Engine", "$100", "1", "3/20/2016"]],
        }
      });
      console.log(res);
    } catch (e) {
      console.error(e);
    } finally {
      this.sending = false;
    }
  }
  async addRow(values = {}) {
    if (!this.columns[this.list]) {
      let columnsRaw = sessionStorage.getItem(spreadsheetId + "/" + this.list + "/columns");
      if (columnsRaw) {
        this.columns[this.list] = JSON.parse(columnsRaw);
      } else {
        await this.getAll();
      }
    }
    let table = new ORM(this.columns[this.list]);
    let rawValue = table.getRaw(values);
    await this.waitSending();
    await this.addRawValues([rawValue]);
  }
  async waitSending(timeout = 1e4) {
    while (this.sending) {
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
  }
  async addColumns(values = []) {
    try {
      let res = await this.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.list + "!A1:Z1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          majorDimension: "ROWS",
          values: [values]
          //values: [["Engine", "$100", "1", "3/20/2016"]],
        }
      });
      console.log(res);
    } catch (e) {
      console.error(e);
    }
  }
  async deleteRow(rowIndex) {
    const sheetId = await this.getSheetIdByName(this.list);
    if (sheetId === null) {
      throw new Error("Лист 'API' не найден");
    }
    await this.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }
        ]
      }
    });
  }
  async updateRow(row, values = {}) {
    if (!this.columns[this.list]) {
      await this.getColumns(this.list);
    }
    let table = new ORM(this.columns[this.list]);
    let rawValue = table.getRaw(values);
    console.debug("values.update", new Error().stack);
    this.waitSending();
    this.sending = true;
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: this.list + "!A" + row,
      valueInputOption: "RAW",
      resource: {
        values: [rawValue]
      }
    }).then((response) => {
      console.log("Value updated successfully:", response);
    }).catch((err) => {
      console.log("Value update failed:", err);
    });
    this.sending = false;
  }
  async getLists() {
    let response = await this.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties.title"
    });
    return response.result.sheets;
  }
  async createList(columns = ["code", "value"]) {
    let title = this.list;
    await this.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties.title"
    }).then((response) => {
      const sheets = response.result.sheets;
      const sheetExists = sheets.some((sheet) => sheet.properties.title === title);
      if (sheetExists) {
        console.debug(`Лист с названием "${title}" уже существует.`);
        return;
      }
      this.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requests: [
          {
            addSheet: {
              properties: {
                title
              }
            }
          }
        ]
      }).then((response2) => {
        console.log("Лист добавлен:", response2.result.replies[0].addSheet.properties.sheetId);
        this.addColumns(columns);
      }).catch((error) => {
        console.error("Ошибка при добавлении листа:", error);
      });
    }).catch((error) => {
      console.error("Ошибка при получении информации о таблице:", error);
    });
  }
  createSpreadSheet(title, callback = null) {
    try {
      this.spreadsheets.create({
        properties: {
          title
        }
      }).then((response) => {
        if (callback)
          callback(response);
        console.log("Spreadsheet ID: " + response.result.spreadsheetId);
      });
    } catch (err) {
      console.error(err.message);
    }
  }
  async clearList() {
    await this.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: this.list + "!A2:Z1000"
    });
  }
  async getRow(row) {
    let range = this.list + "!A" + row + ":Z" + row;
    let spreadsheetId2 = this.spreadsheetId;
    return await this.api.fetchSheetValues({ range, spreadsheetId: spreadsheetId2 });
  }
  async getAll(options = {}) {
    let { caching, formated } = options;
    const range = this.list + "!A1:Z5000";
    let spreadsheetId2 = this.spreadsheetId;
    let response = await this.api.fetchSheetValues({ range, spreadsheetId: spreadsheetId2, caching });
    if (response) {
      this.columns[this.list] = response[0];
      sessionStorage.setItem(spreadsheetId2 + "/" + this.list + "/columns", JSON.stringify(response[0]));
      this.setCodes(response);
      if (formated) {
        return this.formatData(response);
      }
    }
    return response;
  }
  async getColumns(list) {
    if (!this.columns[list]) {
      const range = (list ? list + "!" : "") + "A1:Z1";
      let spreadsheetId2 = this.spreadsheetId;
      const values = await this.api.fetchSheetValues({ range, spreadsheetId: spreadsheetId2 });
      if (values.length > 0) {
        this.columns[list] = values[0];
      }
    }
  }
  setCodes(response) {
    response.forEach((e, i) => {
      this.codes[e[0]] = i;
    });
    let storageKey = this.spreadsheetId + "/" + this.list + "/codes";
    sessionStorage.setItem(storageKey, JSON.stringify(this.codes));
  }
  formatData(response) {
    let result = {};
    response.forEach((e) => {
      if ("{[".includes(e[1][0])) {
        result[e[0]] = JSON.parse(e.slice(1).join(""));
      } else {
        result[e[0]] = e[1];
      }
    });
    return result;
  }
  async updateRowByCode(code, values = {}) {
    let storageKey = this.spreadsheetId + "/" + this.list + "/codes";
    let stored_codes = sessionStorage.getItem(storageKey);
    if (!this.codes.length) {
      if (stored_codes) {
        this.codes = JSON.parse(stored_codes);
      } else {
        await this.getAll();
      }
    } else {
      console.log("все норм");
    }
    if (!values.code) {
      values.code = code;
    }
    let id = this.codes[code] + 1;
    if (id) {
      await this.updateRow(id, values);
      return true;
    } else {
      await this.addRow(values);
      return false;
    }
  }
  async addRows(values = []) {
    if (!this.columns[this.list]) {
      let columnsRaw = sessionStorage.getItem(spreadsheetId + "/" + this.list + "/columns");
      if (columnsRaw) {
        this.columns[this.list] = JSON.parse(columnsRaw);
      } else {
        await this.getAll();
      }
    }
    let table = new ORM(this.columns[this.list]);
    let rawValues = [];
    values.forEach((e) => {
      rawValues.push(table.getRaw(e));
    });
    await this.waitSending();
    try {
      this.sending = true;
      let res = await this.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.list + "!A1:Z1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: {
          majorDimension: "ROWS",
          values: rawValues
          //values: [["Engine", "$100", "1", "3/20/2016"]],
        }
      });
      console.log(res);
    } catch (e) {
      console.error(e);
    } finally {
      this.sending = false;
    }
  }
}
class GoogleSheetDB {
  constructor(options = {}) {
    this.DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";
    this.apiKey = API_KEY;
    this.tokenClient = {};
    this.gapiInited = false;
    this.gisInited = false;
    this.authorize_button = document.getElementById("authorize_button");
    this.headers = [];
    this.columns = {};
    if (this.expired()) {
      localStorage.setItem("gapi_token", "");
    }
    this.storedToken = localStorage.getItem("gapi_token");
    this.callback = options.callback;
    loadScriptOnce({
      src: "https://apis.google.com/js/api.js",
      onload: this.gapiLoaded.bind(this)
    });
    loadScriptOnce({
      src: "https://accounts.google.com/gsi/client",
      onload: this.gisLoaded.bind(this)
    });
    let timer = setInterval(async () => {
      if (document.getElementById("signout_button")) {
        document.getElementById("signout_button").textContent = localStorage.getItem("gapi_token_expires") - this.getTime();
      }
      if (this.expired()) {
        console.log("нужно авторизоваться");
        document.body.dispatchEvent(new Event("doAuth"));
        clearInterval(timer);
      }
    });
    window.GoogleSheetDB = this;
  }
  async waitGoogle(timeout = 1e4) {
    console.trace("ждем гугла");
    const startTime = Date.now();
    while (!(this.gapiInited && this.gisInited)) {
      if (Date.now() - startTime > timeout) {
        throw new Error("Инициализация Google API не завершена в течение отведенного времени." + this.gapiInited + " " + this.gisInited);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  async waitRead(timeout = 1e4) {
    const startTime = Date.now();
    while (!this.gapiInited) {
      if (Date.now() - startTime > timeout) {
        throw new Error("Инициализация Google API не завершена в течение отведенного времени." + this.gapiInited + " " + this.gisInited);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  async waitWrite(timeout = 1e4) {
    const startTime = Date.now();
    while (!this.gisInited) {
      if (Date.now() - startTime > timeout) {
        throw new Error("Инициализация Google API не завершена в течение отведенного времени." + this.gapiInited + " " + this.gisInited);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  expired() {
    return localStorage.getItem("gapi_token_expires") - this.getTime() < 10;
  }
  getTime() {
    return Math.floor(Date.now() / 1e3);
  }
  async gapiLoaded() {
    gapi.load("client", this.initializeGapiClient.bind(this));
  }
  maybeEnableButtons() {
    if (this.gapiInited && this.gisInited) {
      if (this.authorize_button) {
        this.authorize_button.style.visibility = "visible";
      }
    }
  }
  async initializeGapiClient() {
    await gapi.client.init({
      apiKey: this.apiKey,
      discoveryDocs: [this.DISCOVERY_DOC]
    });
    if (this.storedToken) {
      try {
        const parsedToken = JSON.parse(this.storedToken);
        gapi.client.setToken(parsedToken);
      } catch (e) {
        console.warn("Failed to parse stored token:", e);
      }
    }
    this.gapiInited = true;
    if (this.callback)
      this.callback();
    this.maybeEnableButtons();
  }
  gisLoaded() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {
      }
      // пустой, определим в handleAuthClick
    });
    this.gisInited = true;
    this.maybeEnableButtons();
    this.eventHandler();
  }
  eventHandler() {
    if (this.authorize_button) {
      this.authorize_button.onclick = this.handleAuthClick.bind(this, () => {
        location.reload();
      });
    }
    if (document.getElementById("signout_button")) {
      document.getElementById("signout_button").onclick = this.handleSignoutClick.bind(this);
    }
  }
  handleAuthClick(callback) {
    this.tokenClient.callback = async (resp) => {
      if (resp.error !== void 0) {
        throw resp;
      }
      document.getElementById("signout_button").style.visibility = "visible";
      this.authorize_button.innerText = "Refresh";
      const token = gapi.client.getToken();
      localStorage.setItem("gapi_token", JSON.stringify(token));
      localStorage.setItem("gapi_token_expires", JSON.stringify(this.getTime() + resp.expires_in));
      callback();
    };
    if (gapi.client.getToken() === null) {
      this.tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
      this.tokenClient.requestAccessToken({ prompt: "" });
    }
  }
  handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken("");
      localStorage.removeItem("gapi_token");
      document.getElementById("content").innerText = "";
      this.authorize_button.innerText = "Authorize";
    }
  }
  async fetchSheetValues(options) {
    const webStorage = new WebStorage();
    let { range, spreadsheetId: spreadsheetId2, caching } = options;
    let response;
    let data = [];
    let storageKey = range + spreadsheetId2;
    let storageData = await webStorage.getItem(storageKey);
    if (caching && storageData) {
      return JSON.parse(storageData);
    }
    try {
      response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId2,
        range
      });
      console.debug("values.get", new Error().stack);
    } catch (err) {
      console.error(err);
      return data;
    }
    const result = response.result;
    if (!result || !result.values || result.values.length === 0) {
      console.error("No values found.");
      return data;
    }
    data = result.values;
    await webStorage.setItem(storageKey, JSON.stringify(data));
    return data;
  }
}
function loadScriptOnce({ src, onload, async = true, defer = true }) {
  const existingScript = Array.from(document.getElementsByTagName("script")).find((script2) => script2.src === src);
  if (existingScript) {
    console.log(`Скрипт уже загружен: ${src}`);
    onload();
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.async = async;
  script.defer = defer;
  if (onload && typeof onload === "function") {
    script.onload = onload;
  }
  document.head.appendChild(script);
}
const LOCAL_STORAGE_KEY$1 = "todo-list";
function saveToStorage$1(todos2) {
  localStorage.setItem(LOCAL_STORAGE_KEY$1, JSON.stringify(todos2));
}
function loadFromStorage$1() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY$1);
  return data ? JSON.parse(data) : [];
}
const state$1 = {
  todos: loadFromStorage$1()
};
const getters$1 = {
  getTodos: (state2) => state2.todos
};
const mutations$1 = {
  SET_TODOS(state2, todos2) {
    state2.todos = todos2;
  },
  ADD_TODO(state2, payload) {
    const newTask = {
      id: payload.newId,
      task: payload.task,
      completed: false
    };
    state2.todos.unshift(newTask);
    saveToStorage$1(state2.todos);
  },
  TOGGLE_TODO(state2, payload) {
    const item = state2.todos.find((todo) => todo.id === payload);
    if (item) {
      item.completed = !item.completed;
      saveToStorage$1(state2.todos);
    } else {
      console.error("Todo not found with id:", payload);
    }
  },
  DELETE_TODO(state2, payload) {
    const index = state2.todos.findIndex((todo) => todo.id === payload);
    if (index !== -1) {
      state2.todos.splice(index, 1);
      saveToStorage$1(state2.todos);
    } else {
      console.error("Todo not found with id:", payload);
    }
  }
};
const actions$1 = {
  async initTodos({ commit, rootGetters }) {
    const settings2 = rootGetters["settings/allSettings"];
    const spreadsheetSetting = settings2.find((s) => s.code === "spreadsheetId");
    if (!spreadsheetSetting) {
      console.warn("spreadsheetId not found in settings");
      commit("SET_TODOS", loadFromStorage$1());
      return;
    }
    console.log(spreadsheetSetting.value);
    let api = window.GoogleSheetDB || new GoogleSheetDB();
    await api.waitGoogle();
    const table = new Table({
      spreadsheetId: spreadsheetSetting.value,
      list: "real_life_tasks"
    });
    let list = await table.getAll();
    let _todos = [];
    let orm = new ORM(table.columns["real_life_tasks"]);
    list.forEach((e) => {
      _todos.push(orm.getFormated(e));
    });
    const todos2 = _todos;
    commit("SET_TODOS", todos2);
  },
  addTodo({ commit }, payload) {
    commit("ADD_TODO", payload);
  },
  toggleTodo({ commit }, payload) {
    commit("TOGGLE_TODO", payload);
  },
  deleteTodo({ commit }, payload) {
    commit("DELETE_TODO", payload);
  }
};
const todos = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  actions: actions$1,
  getters: getters$1,
  mutations: mutations$1,
  state: state$1
}, Symbol.toStringTag, { value: "Module" }));
const LOCAL_STORAGE_KEY = "todo-settings";
async function saveToStorage(todos2) {
  await localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos2));
}
function loadFromStorage() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}
const state = {
  settings: loadFromStorage()
  // Массив настроек
};
const getters = {
  allSettings: (state2) => state2.settings
  // Получить все настройки
};
const mutations = {
  async SET_SETTINGS(state2, setting) {
    state2.settings.push(setting);
    await saveToStorage(state2.settings);
  },
  async DELETE_SETTING(state2, index) {
    state2.settings.splice(index, 1);
    await saveToStorage(state2.settings);
  }
};
const actions = {
  saveSettings({ commit }, setting) {
    commit("SET_SETTINGS", setting);
  },
  deleteSetting({ commit }, index) {
    commit("DELETE_SETTING", index);
  }
};
const settings = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  actions,
  getters,
  mutations,
  state
}, Symbol.toStringTag, { value: "Module" }));
const store = createStore({
  modules: {
    todos: { ...todos, namespaced: true },
    settings: { ...settings, namespaced: true }
  }
});
createApp(App).use(router).use(store).use(installer).mount("#app");
