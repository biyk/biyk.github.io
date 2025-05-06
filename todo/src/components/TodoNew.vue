<template>
    <form>
        <input
            class="todo-input"
            type="text"
            placeholder="Enter a new task"
            v-model="task_title"
        />
        <button @click="addTodo" type="button">+</button>
    </form>
</template>

<script>
import '../assets/styles/components/TodoNew.css';
import { generateUUIDv4 } from '@/utils/uuid';
export default {
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
</script>

