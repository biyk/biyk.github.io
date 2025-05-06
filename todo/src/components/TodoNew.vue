<template>
    <form>
        <input
            class="todo-input"
            type="text"
            placeholder="Enter a new task"
            v-model="task"
        />
        <button @click="addTodo" type="button">+</button>
    </form>
</template>

<script>
import '../assets/styles/components/TodoNew.css';
import { v4 as uuidv4 } from 'uuid';
export default {
    data() {
        return {
            task: "",
            newId: uuidv4()
        };
    },
    methods: {
        addTodo: function() {
            this.$store.dispatch("todos/addTodo", {
                newId: this.newId,
                task: this.task
            });
            this.newId = uuidv4();
            this.task = "";
        }
    }

};
</script>

