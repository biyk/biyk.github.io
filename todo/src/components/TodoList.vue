<template>
    <ul class="tasks">
        <li>{{getSortedTodos().length}}</li>
        <li
            v-for="todo in getSortedTodos()"
            :key="todo.id"
            :class="['task', todo.task_color, { completed: todo.completed }]"
            @click="toggleTodo(todo.task_uuid)"
        >
            <span :title="taskDate(todo.start_date)">({{ todo.task_sort }} / {{taskSort(todo)}}) {{ todo.task_title }} ({{taskDate(todo.start_date)}})</span>
            <span class="delete" @click="deleteTodo(todo.task_uuid)">ⓧ</span>
        </li>
    </ul>
</template>

<script>
import '../assets/styles/components/TodoList.css';
import {makeTaskDone, taskDate, taskSort} from "@/utils/tasks.js";
import {addEvent, listEvents, updateEvent} from "@/utils/calendar.js";

export default {
    computed: {
        todos() {
            return this.$store.getters["todos/getTodos"];
        },
        events() {
            return this.$store.getters["events/getEvents"];
        },
    },
    props: {
        filter: {
            type: String,
            default: 'all'
        }
    },
    methods: {
        taskDate,
        taskSort,
        getFilteredTodos() {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate() , 23, 59, 0, 0).getTime();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            return this.todos.filter(todo => {
                if (todo.task_title.includes('task_title')) return false;
                const start = todo.start_date;
                switch (this.filter) {
                    case 'today':
                        return start < today;
                    case 'calendar':
                        const calendarEvents = this.events;
                        const hasMatchingEvent = calendarEvents?.some(
                            event => event.description?.includes(todo.task_uuid)
                        );
                        return start < today && hasMatchingEvent;
                    case 'tomorrow':
                        return start > today && start < tomorrow;
                    default:
                        return true;
                }
            });
        },
        async toggleTodo(task_uuid) {
            const task = this.todos.filter(todo => todo.task_uuid === task_uuid);
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - task[0].task_time * 60 * 1000);
            const event = {
                summary: task[0].task_title,
                description: task[0].task_uuid,
                colorId: 7,
                start: {
                    dateTime: startDate.toISOString(),
                    timeZone: 'Europe/Samara',
                },
                end: {
                    dateTime: endDate.toISOString(),
                    timeZone: 'Europe/Samara',
                },
            };
            let list = await listEvents(this.$store);

            let exist = list.filter(event => event.description?.includes(task_uuid));
            if(exist.length){
                event.summary = exist[0].summary;
                event.id = exist[0].id
                await updateEvent(event)
            } else {

                await addEvent(event);
            }
            makeTaskDone(task, this.$store);
        },
        deleteTodo(task_uuid) {
            const task = this.todos.filter(todo => todo.task_uuid === task_uuid);
            makeTaskDone(task, this.$store, {deleted:1});
        },
        getSortedTodos(){
            switch (this.filter) {
                case 'calendar':
                    const calendarOrder = this.events
                        .map(event => event.description)
                        .filter(uuid => uuid); // удалим undefined/null

                    // Создаём карту соответствия UUID → порядок
                    const uuidOrderMap = new Map();
                    calendarOrder.forEach((uuid, index) => {
                        uuidOrderMap.set(uuid, index);
                    });

                    // сортируем по их порядку в events
                    return this.getFilteredTodos()
                        .sort((a, b) => uuidOrderMap.get(a.task_uuid) - uuidOrderMap.get(b.task_uuid));
                case 'today':
                case 'tomorrow':
                default:
                    return this.getFilteredTodos().sort((a, b) => {
                        return taskSort(a) - taskSort(b)
                    });
            }
        }
    },
    mounted() {
        this.$store.dispatch("todos/initTodos");
        listEvents(this.$store);
    }
};
</script>


