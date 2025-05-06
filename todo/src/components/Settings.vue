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
    </div>
</template>

<script>
import { generateUUIDv4 } from '@/utils/uuid';

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
