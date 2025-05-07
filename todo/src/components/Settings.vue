<template>
    <div class="settings">
        <h2>Настройки</h2>

        <!-- Кнопка "Добавить" -->
        <button @click="showForm = !showForm">
            {{ showForm ? 'Отмена' : 'Добавить' }}
        </button>

        <!-- Форма для ввода нового значения -->
        <div v-if="showForm" class="form">
            <input
                v-model="code"
                placeholder="Код (code)"
                type="text"
            />
            <input
                v-model="value"
                placeholder="Значение (value)"
                type="text"
            />
            <button @click="saveSetting">Сохранить</button>
        </div>

        <!-- Отображаем список сохранённых пар код/значение -->
        <div v-if="settings.length > 0">
            <h3>Сохранённые настройки:</h3>
            <ul>
                <li v-for="(setting, index) in settings" :key="index">
                    <span>{{ setting.code }}: {{ setting.value }}</span>
                    <button @click="deleteSetting(index)">Удалить</button>
                </li>
            </ul>
        </div>
        <button @click="setTaskToCalendar">Заполнить календарь</button>
    </div>
</template>

<script>
import { generateUUIDv4 } from '@/utils/uuid';
import {addEvent, getFreeSlots, listEvents} from "@/utils/calendar.js";

export default {
    name: 'Settings',
    data() {
        return {
            showForm: false,
            code: '',
            value: '',
        }
    },
    computed: {
        // Получаем все настройки из хранилища
        settings() {
            return this.$store.state.settings.settings  // assuming you're using the 'settings' module
        }
    },
    methods: {
        // Сохраняем новую пару код/значение
        saveSetting() {
            const setting = {
                code: this.code.trim(),
                uid: generateUUIDv4(),
                value: this.value.trim(),
            }

            if (!setting.code || !setting.value) {
                alert("Оба поля обязательны")
                return
            }

            // Отправляем сохранение в Vuex
            this.$store.dispatch("settings/saveSettings", setting)

            // Очистить форму и скрыть её
            this.code = ''
            this.value = ''
            this.showForm = false
        },
        // Удаляем настройку по индексу
        deleteSetting(index) {
            this.$store.dispatch("settings/deleteSetting", index)
        },
        async setTaskToCalendar() {
            //получаем список задач на сегодня
            let all = this.$store.getters["todos/getTodos"];
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0).getTime();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0).getTime();
            let today_tasks = all.filter(todo => {
                if (todo.task_title === 'task_title') return false;
                const start = todo.start_date;
                return start < today;
            });

            //получаем список дел на сегодня
            let today_events = await listEvents();

            //записываем в свободные места календаря события
            let freeSlots = getFreeSlots(today_events);
            let count = 0;
            for (const task of today_tasks) {
                let duration = task.task_time;
                //поиск свободного слота под задачу
                let slotIndex = freeSlots.findIndex(slot => slot.duration >= duration);
                if (slotIndex === -1) continue; // нет подходящего слота
                if (count++ > 10) continue;
                let slot = freeSlots[slotIndex];

                //добавление события в календарь
                //TODO проверить что событие еще не добавлено в календарь
                const endDate = new Date(new Date(slot.start).getTime() + duration * 60 * 1000);
                const event = {
                    summary: task.task_title,
                    description: task.task_uuid,
                    start: {
                        dateTime: slot.start,
                        timeZone: 'Europe/Samara',
                    },
                    end: {
                        dateTime: endDate.toISOString(),
                        timeZone: 'Europe/Samara',
                    },
                };

                //
                await addEvent(event);

                // обновление или удаление слота
                const updatedDuration = slot.duration - duration;
                if (updatedDuration < 15) {
                    //удалить слот
                    freeSlots.splice(slotIndex, 1);
                } else {
                    //обновить слот
                    freeSlots[slotIndex].start = endDate.toISOString();
                    freeSlots[slotIndex].duration = updatedDuration;
                }
            }
        }
    },
}
</script>

<style scoped>
.settings {
    margin-top: 1rem;
}
.form {
    margin-top: 1rem;
}
input {
    display: inline-block;
    margin-right: 0.5rem;
    padding: 0.5rem;
    width: 150px;
}
button {
    padding: 0.5rem 1rem;
    margin-left: 1rem;
}
ul {
    list-style-type: none;
    padding: 0;
}
li {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
}
li button {
    margin-left: 10px;
    padding: 0.2rem 0.5rem;
}
</style>
