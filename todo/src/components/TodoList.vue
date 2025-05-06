<template>
    <ul class="tasks">
        <li
            v-for="todo in getSortedTodos()"
            :key="todo.id"
            :class="['task', todo.task_color, { completed: todo.completed }]"
            @click="toggleTodo(todo.task_uuid)"

        >
            <span :title="todo.task_description">({{ todo.money_reward }}) {{ todo.task_title }}</span>
            <span class="delete" @click="deleteTodo(todo.id)">ⓧ</span>
        </li>
    </ul>
</template>

<script>
import '../assets/styles/components/TodoList.css';
import {makeTaskDone} from "@/utils/tasks.js";
export default {
    computed: {
        todos() {
            return this.$store.getters["todos/getTodos"];
        },
    },
    props: {
        filter: {
            type: String,
            default: 'all'
        }
    },
    methods: {
        getFilteredTodos() {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate() , 23, 59, 0, 0).getTime();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();

            return this.todos.filter(todo => {
                if (todo.task_title === 'task_title') return false;

                const start = todo.start_date;
                switch (this.filter) {
                    case 'today':
                        return start < today;
                    case 'tomorrow':
                        return start > today && start < tomorrow;
                    default:
                        return true;
                }
            });
        },
        toggleTodo(task_uuid) {
            const task = this.todos.filter(todo => todo.task_uuid === task_uuid);
            makeTaskDone(task, this.$store);
        },
        deleteTodo(id) {
            this.$store.dispatch("todos/deleteTodo", id);
        },
        getSortedTodos(){
            return this.getFilteredTodos().sort((a, b) => a.task_sort - b.task_sort);
        }
    },
    mounted() {
        this.$store.dispatch("todos/initTodos");
    }
};
</script>


