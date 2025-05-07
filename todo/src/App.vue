<template>
    <div class="container">
        <h1>To-Do List</h1>
        <el-tabs v-model="activeTab">
            <el-tab-pane label="Добавить" name="new">
                <TodoNew />
            </el-tab-pane>
            <el-tab-pane label="Сегодня" name="today">
                <TodoList filter="today"  />
            </el-tab-pane>
            <el-tab-pane label="Завтра" name="tomorrow">
                <TodoList filter="tomorrow"  />
            </el-tab-pane>
            <el-tab-pane label="Список" name="list">
                <TodoList filter="all" />
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
    setup() {
        const activeTab = computed({
            get() {
                return window.location.hash.replace('#/', '') || 'new';
            },
            set(val) {
                console.log(val)
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
    }

}
</script>

