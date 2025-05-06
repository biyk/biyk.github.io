<template>
  <ul class="tasks">
    <li
      v-for="todo in todos"
      :key="todo.id"
      :class="{ completed: todo.completed }"
      class="task"
      @click="toggleTodo(todo.id)"
    >
      {{ todo.task }}
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


