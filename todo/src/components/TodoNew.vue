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
import {GoogleSheetDB, Table} from "../../../dnd/static/js/db/google.js";
export default {
    data() {
        return {
            task_title: "",
            task_uuid: generateUUIDv4()
        };
    },
    methods: {
        addTodo: async function () {
            const api = window.GoogleSheetDB || new GoogleSheetDB();
            await api.waitGoogle();

            const settings = this.$store.getters["settings/allSettings"];
            const spreadsheetSetting = settings.find(s => s.code === "spreadsheetId");

            let table = new Table({
                spreadsheetId: spreadsheetSetting.value,
                list: "real_life_tasks"
            });

            this.task_uuid = generateUUIDv4();
            await table.addRow({
                task_uuid: this.task_uuid,
                task_title: this.task_title,
                task_date: new Date().getTime(),
                task_sort: 100,
                task_time: 15,
                repeat_index: 1,
                date_mode: 1,
                break_multiplier: 1,
                task_color: 'blue',
                money_reward: 7,
                repeat_mode: 6,
                task_finish_date: 0,
                start_date: 0,
                number_of_executions: 0
            })

            this.task_title = "";
        }
    }

};
</script>

