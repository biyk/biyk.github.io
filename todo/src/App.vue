<template>
    <div class="container">
        <h1>To-Do List</h1>
        <el-tabs v-model="activeTab">
            <el-tab-pane label="Добавить задачу" name="new">
                <TodoNew />
            </el-tab-pane>
            <el-tab-pane label="Список задач" name="list">
                <TodoList />
            </el-tab-pane>
            <el-tab-pane label="Настройки" name="settings">
                <div>Тут будут настройки</div>
                <Settings/>
            </el-tab-pane>
        </el-tabs>
        <img src="@/assets/logo.png" class="vue-logo" alt="Vue.js Logo" />
    </div>
</template>

<script>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TodoNew from "@/components/TodoNew.vue"
import TodoList from "@/components/TodoList.vue"
import 'element-plus/dist/index.css'
import './assets/styles/App.css'
import Settings from "@/components/Settings.vue";

export default {
    components: {
        Settings,
        TodoNew,
        TodoList
    },
    setup() {
        const route = useRoute()
        const router = useRouter()

        const activeTab = computed({
            get() {
                return route.query.tab || 'new'
            },
            set(val) {
                router.replace({ query: { ...route.query, tab: val } })
            }
        })

        return { activeTab }
    }
}
</script>

