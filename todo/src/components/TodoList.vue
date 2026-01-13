<template>
    <el-radio-group v-model="selectedFilter" class="neumorphic-radio-group">
        <el-radio-button value="calendar" class="neumorphic-button">Сейчас</el-radio-button>
        <el-radio-button value="today" class="neumorphic-button">Сегодня</el-radio-button>
        <el-radio-button value="tomorrow" class="neumorphic-button">Завтра</el-radio-button>
        <el-radio-button value="all" class="neumorphic-button">Все</el-radio-button>
    </el-radio-group>
    <hr>
    <button v-if="selectedFilter==='calendar'" @click="setTaskToCalendar">Заполнить календарь</button>
    <button  v-if="selectedFilter==='0'" @click="setTaskCompleted">Отметить завершенные</button>
    <ul class="tasks">
        <li>{{getSortedTodos().length}} ({{getTotalTime()}} ч.) <span style="float: right"
        ><span title="Времени сегодня">{{log.today}}</span> /
            <span title="В среднем за неделю">{{log.week}}</span> /
            <span title="В среднем за месяц">{{log.month}}</span>
            (<span title="Уровень дисциплины">{{calc.averageCalc?.toFixed(2)}}</span> /
            <span title="Проверка дисциплины">{{calc.prevAvg?.toFixed(2)}}</span>)
        </span></li>
        <li
            v-for="todo in getSortedTodos()"
            :key="todo.id"
            :class="['task', todo.task_color, { completed: todo.completed }]"
        >
            <span
                class="task-description"
                :title="'task_date: ' + taskDate(todo.task_date) + ', last_execution: ' + taskDate(todo.last_execution)
                 + ', repeat: ' + repeat(todo)"
                @click="togglePopover(todo.task_uuid)"
            >
                ({{ todo.task_time}}) {{ todo.task_title }}
                <span class="task-repeat_index">({{ parseFloat(todo.repeat_index.toString().replace(',', '.')).toFixed(2) }})</span>

                <span v-if="parseInt(todo.start_date)"> {{ ((currentTime - todo.start_date) / (60*1000)).toFixed(2)}}</span>
                <span v-else-if="parseInt(todo.task_finish_date)"> {{ ((todo.task_finish_date) / (60*1000)).toFixed(2)}}</span>
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
                    <button class="start" v-if="todo.start_date == 0" @click="startTask(todo)">▶️</button>
                    <span v-else>
                      <button  class="pause" @click.stop="pauseTask(todo)">⏸</button>
                    </span>
                </span>
                <span  v-if="todo.start_date == 0" class="done" @click.stop="toggleTodo(todo.task_uuid)">✅</span>
                <span v-else class="done" >
                    <button @click.stop="toggleTodo(todo.task_uuid)">⏹</button>
                </span>
                <span v-if="selectedFilter==='calendar'" class="delete" @click.stop="deleteTodo(todo.task_uuid)" title="Нет возможности, нет сил сделать">ⓧ</span>
            </div>
        </li>

    </ul>
</template>

<script>
import '../assets/styles/components/TodoList.css';
import {calcExecutions, makeTaskDone, setTaskCompleted, setTaskToCalendar, taskDate, taskSort} from "@/utils/tasks.js";
import {addEvent, deleteEvent, listEvents, updateEvent} from "@/utils/calendar.js";
import throttle from 'lodash/throttle';

export default {
    data() {
        return {
            visiblePopover: null,
            total: 0,
            timer: 0,
            currentTime: 0,
            log:{},
            selectedFilter: 'calendar'
        };
    },
    computed: {
        todos() {
            return this.$store.getters["todos/getTodos"];
        },
        events() {
            return this.$store.getters["events/getEvents"];
        },
        calc(){
            return  this.$store.getters["settings/allCalc"];
        }
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
            const task_done_color = '7';
            const now = new Date();
            //const today = new Date().getTime();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            const end_today = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 1).getTime();
            return this.todos.filter(todo => {
                if (todo.task_title.includes('task_title')) return false;
                const start = parseInt(todo.task_date);
                switch (this.selectedFilter) {
                    case 'calendar':
                        const calendarEvents = this.events;
                        const matchingEvent = calendarEvents?.find(
                            event => event.description?.includes(todo.task_uuid)
                        );

                        return (start < end_today || matchingEvent?.colorId !== task_done_color);
                    case 'today':
                        return start < end_today;
                    case 'tomorrow':
                        return start > end_today && start < tomorrow;
                    default:
                        return true;
                }
            });
        },
        repeat(todo){
            return ((new Date().getTime() - todo.last_execution)/(24 * 60 * 60 * 1000)).toFixed(2)
        },
        closeEditor(todo) {
            this.visiblePopover = null;
            this.$store.dispatch("todos/updateTodo", { ...todo }); // принудительное сохранение
        },

        async toggleTodo(task_uuid) {
            this.doAuth();
            const task = this.todos.filter(todo => todo.task_uuid === task_uuid);
            let start_date = parseInt(task[0].start_date)
            task[0].completed = true;
            if (start_date) {
                const now = Date.now();
                const durationMs = now - start_date;
                const minutesSpent = Math.ceil(durationMs / 60000); // округление вверх

                const previous = Number(task[0].task_time) || 0;
                const newAverage = Math.ceil((previous + minutesSpent) / 2);
                task[0].task_time = newAverage;
                task[0].start_date = 0;
            }
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - task[0].task_time * 60 * 1000);
            const task_done_color = '7';
            const event = {
                summary: task[0].task_title,
                description: task[0].task_uuid,
                colorId: task_done_color,
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
                task[0].repeat_index = parseFloat( task[0].repeat_index.toString().replace(',', '.')) - 0.1;
                task[0].task_sort = parseFloat( task[0].task_sort.toString().replace(',', '.')) - 0.02;
            }
            setTimeout(async () => {
                await makeTaskDone(task, this.$store);
                this.log = await calcExecutions(this.$store);
                console.log(this.log);
            }, 300)
        },
        deleteTodo: throttle(async function (task_uuid) {
            this.doAuth();
            const task = this.todos.filter(todo => todo.task_uuid === task_uuid);
            let list = await listEvents(this.$store);
            let exist = list.filter(event => event.description?.includes(task_uuid));
            task[0].completed = true;
            if(exist.length){
                await deleteEvent(exist[0])
                task[0].break_multiplier = parseFloat(task[0].break_multiplier) - 0.1;
                task[0].repeat_index = parseFloat( task[0].repeat_index.toString().replace(',', '.')) + 0.1;
            }
            await makeTaskDone(task, this.$store, {deleted: 1});
        }, 1000),
        getSortedTodos(){
            switch (this.selectedFilter) {
                case 'calendar':
                    // Получаем список отфильтрованных задач
                    const filteredTodos = this.getFilteredTodos();
                    // Создаём пустой массив для результата
                    let sortedTodos = [];

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

                    // Создаём карту задач для быстрого доступа по UUID
                    const todoMap = new Map();
                    filteredTodos.forEach(todo => {
                        todoMap.set(todo.task_uuid, todo);
                    });
                    const existMap = new Map();
                    sortedTodos.forEach(todo => {
                        existMap.set(todo.task_uuid, todo);
                    });

                    // Проходим по событиям и добавляем соответствующие задачи в результат
                    this.events.forEach(event => {
                        const uuids = event.description?.split('\n');
                        uuids?.forEach(uuid=>{
                            if (uuid && todoMap.has(uuid) && !existMap.has(uuid)) {
                                sortedTodos.push(todoMap.get(uuid));
                            }
                        });

                    });

                    // Возвращаем отсортированные задачи
                    return sortedTodos;
                case 'all':
                    return this.getFilteredTodos().sort((a, b) => {
                        let sort = function (todo) {
                            return parseFloat(todo.repeat_index.toString().replace(',', '.'))
                        }
                        return this.repeat(b)/sort(b) - (this.repeat(a)/sort(a))
                    });
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
            this.doAuth();
            if (todo.task_finish_date){
                todo.start_date = Date.now() - todo.task_finish_date;
            } else  {
                todo.start_date = Date.now(); // текущее время в миллисекундах
            }
            this.$store.dispatch("todos/updateTodo", { ...todo });
        },
        pauseTask(todo) {
            this.doAuth();
            const now = Date.now();
            todo.task_finish_date = now - todo.start_date;
            todo.start_date = 0;
            this.$store.dispatch("todos/updateTodo", { ...todo });
        },
        doAuth() {
            let api = window.GoogleSheetDB || new GoogleSheetDB();
            if (api.expired()){
                document.getElementById('authorize_button').click()
            }
        }
    },
    async mounted() {
        this.$store.dispatch("todos/initTodos");
        await listEvents(this.$store);
        this.timer = setInterval(() => {
            this.currentTime = new Date().getTime();
        }, 1000);
        this.log = await calcExecutions(this.$store);
        this.selectedFilter = this.filter;
    }
};
</script>

<style scoped>
.neumorphic-radio-group {
    display: flex;
    gap: 10px;
    padding: 10px;
    background: #e0e0e0; /* общий фон */
    border-radius: 20px;
}

.neumorphic-button {
    background: #e0e0e0;
    border: none;
    border-radius: 12px;
    padding: 10px 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 4px 4px 8px #bebebe,
    -4px -4px 8px #ffffff;
}

/* Активная (впуклая) кнопка */
.el-radio-button__original-radio:checked + .neumorphic-button,
.el-radio-button.is-active.neumorphic-button {
    box-shadow: inset 4px 4px 8px #bebebe,
    inset -4px -4px 8px #ffffff;
}

/* Hover эффект для большей интерактивности */
.neumorphic-button:hover {
    box-shadow: 2px 2px 4px #bebebe,
    -2px -2px 4px #ffffff;
}

</style>
