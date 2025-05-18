<template>
    <button v-if="filter==='calendar'" @click="setTaskToCalendar">Заполнить календарь</button>
    <button  v-if="filter==='calendar'" @click="setTaskCompleted">Отметить завершенные</button>
    <ul class="tasks">
        <li>{{getSortedTodos().length}} ({{getTotalTime()}} ч.)</li>
        <li
            v-for="todo in getSortedTodos()"
            :key="todo.id"
            :class="['task', todo.task_color, { completed: todo.completed }]"
        >
                    <span
                        :title="taskDate(todo.task_date)"
                        @click="togglePopover(todo.task_uuid)"
                        style="cursor: pointer;"
                    >
                        ({{ todo.task_sort }} / {{taskSort(todo)}}) {{ todo.task_title }} ({{taskDate(todo.task_date)}})
                    </span>

            <div v-if="visiblePopover === todo.task_uuid" class="editable-description">
                <textarea
                    v-model="todo.task_description"
                    rows="3"
                    style="width: 100%; margin-top: 8px;"
                ></textarea>
                <button @click="closeEditor(todo)" style="margin-top: 4px;">✅ Сохранить</button>
            </div>


            <div v-if="!visiblePopover !== todo.task_uuid" class="buttons">
                <!-- Кнопки Старт / Стоп -->
                <span style="margin-right: 8px;">
                    <button v-if="todo.start_date == 0" @click="startTask(todo)">▶️</button>
                    <button v-else @click="stopTask(todo)">⏹ </button>
                </span>
                <span class="done" @click.stop="toggleTodo(todo.task_uuid)">✅</span>
                <span class="delete" @click.stop="deleteTodo(todo.task_uuid)">ⓧ</span>
            </div>
        </li>

    </ul>
</template>

<script>
import '../assets/styles/components/TodoList.css';
import {makeTaskDone, setTaskCompleted, setTaskToCalendar, taskDate, taskSort} from "@/utils/tasks.js";
import {addEvent, listEvents, updateEvent} from "@/utils/calendar.js";
import throttle from 'lodash/throttle';
export default {
    data() {
        return {
            visiblePopover: null,
            total: 0
        };
    },
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
        setTaskCompleted,
        setTaskToCalendar,
        taskDate,
        taskSort,
        getFilteredTodos() {
            const now = new Date();
            const today = new Date().getTime();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            return this.todos.filter(todo => {
                if (todo.task_title.includes('task_title')) return false;
                const start = parseInt(todo.task_date);
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

        closeEditor(todo) {
            this.visiblePopover = null;
            this.$store.dispatch("todos/updateTodo", { ...todo }); // принудительное сохранение
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
                //т.к. задача была не на сегодня
                task[0].break_multiplier = parseInt(task[0].break_multiplier) + 1;
            }
            makeTaskDone(task, this.$store);
        },
        deleteTodo: throttle(function(task_uuid) {
            const task = this.todos.filter(todo => todo.task_uuid === task_uuid);
            makeTaskDone(task, this.$store, { deleted: 1 });
        }, 1000),
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
        },
        getTotalTime() {
            let summ = 0;
            this.getSortedTodos().forEach((task) => {
                summ += Number(task.task_time) || 0;
            });
            return (summ / 60).toFixed(2);
        },
        togglePopover(uuid) {
            this.visiblePopover = this.visiblePopover === uuid ? null : uuid;
        },
        startTask(todo) {
            todo.start_date = Date.now(); // текущее время в миллисекундах
            this.$store.dispatch("todos/updateTodo", { ...todo });
        },
        stopTask(todo) {
            const now = Date.now();
            const durationMs = now - todo.start_date;
            const minutesSpent = Math.ceil(durationMs / 60000); // округление вверх

            const previous = Number(todo.task_time) || 0;
            const newAverage = Math.ceil((previous + minutesSpent) / 2);

            todo.task_time = newAverage;
            todo.start_date = 0;
            todo.completed = true;

            this.$store.dispatch("todos/updateTodo", { ...todo });
            this.toggleTodo(todo.task_uuid)
        },
    },
    mounted() {
        this.$store.dispatch("todos/initTodos");
        listEvents(this.$store);
    }
};
</script>


