<template>
    <div class="container">
        <h1>{{hero.hero_name}} {{hero.hero_money}}</h1>
        <el-tabs v-model="activeTab">
            <el-tab-pane label="Календарь" name="calendar">
                <TodoList filter="calendar"  />
            </el-tab-pane>
            <el-tab-pane label="Активные задачи" name="today">
                <TodoList filter="today"  />
            </el-tab-pane>
            <el-tab-pane label="Список" name="list">
                <TodoList filter="all" />
            </el-tab-pane>
            <el-tab-pane label="Добавить" name="new">
                <TodoNew />
            </el-tab-pane>
            <el-tab-pane label="Магазин" name="shop">
                <div>Тут будут покупки</div>
            </el-tab-pane>
            <el-tab-pane label="Персонаж" name="player">
                <div>Тут будут данные игрока</div>
            </el-tab-pane>
            <el-tab-pane label="Настройки" name="settings">
                <Settings/>
            </el-tab-pane>
        </el-tabs>
        <img src="@/assets/logo.png" class="vue-logo" alt="Vue.js Logo" />
    </div>
</template>

<script>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import TodoNew from "@/components/TodoNew.vue"
import TodoList from "@/components/TodoList.vue"
import Settings from "@/components/Settings.vue"
import { useStore } from 'vuex'
import 'element-plus/dist/index.css'
import './assets/styles/App.css'
import { startTaskAgent, stopTaskAgent } from "@/agents/taskAgent.js"  // ← 🔥

export default {
    components: {
        Settings,
        TodoNew,
        TodoList
    },
    computed: {
        hero() {
            return this.$store.getters["hero/getHero"];
        },
    },
    setup() {
        const activeTab = computed({
            get() {
                return window.location.hash.replace('#/', '') || 'calendar';
            },
            set(val) {
                window.location.hash = val;
            }
        });

        const store = useStore();

        onMounted(() => {
            startTaskAgent(store);
        });

        onBeforeUnmount(() => {
            stopTaskAgent();
        });

        return { activeTab };
    },
    mounted() {
        this.$store.dispatch("hero/initHero");
    }

}
</script>

