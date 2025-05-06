<template>
    <ul class="tasks">
        <li
            v-for="todo in sortedTodos"
            :key="todo.id"
            :class="['task', todo.task_color, { completed: todo.completed }]"
            @click="toggleTodo(todo.id)"

        >
            <span :title="todo.task_description">({{ todo.money_reward }}) {{ todo.task_title }}</span>
            <span class="delete" @click="deleteTodo(todo.id)">ⓧ</span>
        </li>
    </ul>
</template>

<script>
import '../assets/styles/components/TodoList.css';
export default {
    computed: {
        todos() {
            return this.$store.getters["todos/getTodos"];
        },
        filteredTodos() {
            const now = new Date();
            const today = now.getTime();
            console.log(this.filter);
            const tomorrow = (new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1, // Завтра
                23, 59, 0, 0       // Время: 23:59:00.000
            )).getTime();

            return this.todos.filter(todo => {
                if (todo.task_title === 'task_title') return false;

                const start = todo.start_date; // предполагаем, что есть поле `due_date`
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
        sortedTodos() {
            let todos = this.filteredTodos;
            // Сортировка по полю `task_sort`, предполагается, что это число
            return todos.sort((a, b) => a.task_sort - b.task_sort);
        }
    },
    props: {
        filter: {
            type: String,
            default: 'all'
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
</script>


