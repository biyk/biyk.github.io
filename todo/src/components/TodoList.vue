<template>
    <button v-if="filter==='calendar'" @click="setTaskToCalendar">Заполнить календарь</button>
    <button  v-if="filter==='0'" @click="setTaskCompleted">Отметить завершенные</button>
    <ul class="tasks">
        <li>{{getSortedTodos().length}} ({{getTotalTime()}} ч.)</li>
        <li
            v-for="todo in getSortedTodos()"
            :key="todo.id"
            :class="['task', todo.task_color, { completed: todo.completed }]"
        >
            <span
                class="task-description"
                :title="taskDate(todo.task_date)"
                @click="togglePopover(todo.task_uuid)"
            >
                ({{ todo.task_time}}) {{ todo.task_title }}
                <span v-if="parseInt(todo.start_date)"> {{ ((currentTime - todo.start_date) / (60*1000)).toFixed(2)}}</span>
            </span>

            <div v-if="visiblePopover === todo.task_uuid" class="editable-description">
                <textarea
                    v-model="todo.task_description"
                    rows="3"
                    style="width: 100%; margin-top: 8px;"
                ></textarea>
                <button @click="closeEditor(todo)" style="margin-top: 4px;">✅ Сохранить</button>
            </div>


            <div v-if="visiblePopover !== todo.task_uuid" class="buttons">
                <!-- Кнопки Старт / Стоп -->
                <span style="margin-right: 8px;">
                    <button v-if="todo.start_date == 0" @click="startTask(todo)">▶️</button>
                    <span v-else>
                      <button @click.stop="pauseTask(todo)">⏸</button>
                    </span>
                </span>
                <span  v-if="todo.start_date == 0" class="done" @click.stop="toggleTodo(todo.task_uuid)">✅</span>
                <span v-else class="done" >
                    <button @click.stop="toggleTodo(todo.task_uuid)">⏹</button>
                </span>
                <span class="delete" @click.stop="deleteTodo(todo.task_uuid)">ⓧ</span>
                <span v-if="filter==='all'" class="plus" >Добавить задачу в календарь</span>
            </div>
        </li>

    </ul>
</template>

<script>
import '../assets/styles/components/TodoList.css';
import {makeTaskDone, setTaskCompleted, setTaskToCalendar, taskDate, taskSort} from "@/utils/tasks.js";
import {addEvent, deleteEvent, listEvents, updateEvent} from "@/utils/calendar.js";
import throttle from 'lodash/throttle';

export default {
    data() {
        return {
            visiblePopover: null,
            total: 0,
            timer: 0,
            currentTime: 0,
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
            const end_today = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 1).getTime();
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
                        return start < end_today && hasMatchingEvent;
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
            let start_date = parseInt(task[0].start_date)
            if (start_date) {
                const now = Date.now();
                const durationMs = now - start_date;
                const minutesSpent = Math.ceil(durationMs / 60000); // округление вверх

                const previous = Number(task[0].task_time) || 0;
                const newAverage = Math.ceil((previous + minutesSpent) / 2);
                task[0].task_time = newAverage;
                task[0].start_date = 0;
                task[0].completed = true;
            }
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
                task[0].break_multiplier = parseFloat(task[0].break_multiplier) + 1;
                task[0].repeat_index = parseFloat(task[0].repeat_index) - 0.1;
            }
            setTimeout(()=>{
                makeTaskDone(task, this.$store);
            }, 300)
        },
        deleteTodo: throttle(async function (task_uuid) {
            const task = this.todos.filter(todo => todo.task_uuid === task_uuid);
            let list = await listEvents(this.$store);
            let exist = list.filter(event => event.description?.includes(task_uuid));
            if(exist.length){
                let eventId = exist[0].id
                await deleteEvent(eventId)
                task[0].break_multiplier = parseFloat(task[0].break_multiplier) - 0.1;
                task[0].repeat_index = parseFloat(task[0].repeat_index) + 0.1;
            }
            makeTaskDone(task, this.$store, {deleted: 1});
        }, 1000),
        getSortedTodos(){
            switch (this.filter) {
                case 'calendar':
                    // Получаем список отфильтрованных задач
                    const filteredTodos = this.getFilteredTodos();
                    // Создаём пустой массив для результата
                    let sortedTodos = [];

                    // Создаём карту задач для быстрого доступа по UUID
                    const todoMap = new Map();
                    filteredTodos.forEach(todo => {
                        todoMap.set(todo.task_uuid, todo);
                    });

                    // Проходим по событиям и добавляем соответствующие задачи в результат
                    this.events.forEach(event => {
                        const uuids = event.description?.split('\n');
                        uuids?.forEach(uuid=>{
                            if (uuid && todoMap.has(uuid)) {
                                sortedTodos.push(todoMap.get(uuid));
                            }
                        });

                    });

                    sortedTodos = sortedTodos.concat(
                        this.todos.filter(todo => {
                            // Проверка, есть ли уже такой task_uuid в sortedTodos
                            const alreadyIncluded = sortedTodos.some(e => e.task_uuid === todo.task_uuid);

                            // Добавляем только если его ещё нет и поля корректны
                            return !alreadyIncluded &&
                                ((parseInt(todo.task_time) &&
                                parseInt(todo.task_finish_date)) || parseInt(todo.start_date));
                        })
                    );
                    // Возвращаем отсортированные задачи
                    return sortedTodos;
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
            if (todo.task_finish_date){
                todo.start_date = Date.now() - todo.task_finish_date;
            } else  {
                todo.start_date = Date.now(); // текущее время в миллисекундах
            }
            this.$store.dispatch("todos/updateTodo", { ...todo });
        },
        pauseTask(todo) {
            const now = Date.now();
            todo.task_finish_date = now - todo.start_date;
            todo.start_date = 0;
            this.$store.dispatch("todos/updateTodo", { ...todo });
        },
    },
    mounted() {
        this.$store.dispatch("todos/initTodos");
        listEvents(this.$store);
        this.timer = setInterval(() => {
            this.currentTime = new Date().getTime();
        }, 1000);
    }
};
</script>


