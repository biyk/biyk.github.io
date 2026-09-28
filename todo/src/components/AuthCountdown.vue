<template>
    <span class="auth-countdown" :class="{ expired: expired }" :title="title">
        авторизация: {{ display }}
    </span>
</template>

<script>
import { authLeftSeconds, formatAuthLeft } from '@/utils/auth.js';
import { formatDateTime } from '@/utils/format.js';

export default {
    name: 'AuthCountdown',
    data() {
        return {
            timer: 0,
            left: null,
            text: null,
        };
    },
    computed: {
        display() {
            return this.text || 'нет доступа';
        },
        // Порог тот же, что у google.js.expired(): последние секунды считаем истёкшими
        expired() {
            return this.left === null || this.left < 10;
        },
        title() {
            return this.left === null
                ? 'Токен Google ещё не получен (нужна авторизация)'
                : `Доступ до ${formatDateTime((Math.floor(Date.now() / 1000) + this.left) * 1000)}`;
        },
    },
    methods: {
        refresh() {
            const raw = localStorage.getItem('gapi_token_expires');
            this.left = authLeftSeconds(raw);
            this.text = formatAuthLeft(raw);
        },
    },
    mounted() {
        this.refresh();
        this.timer = setInterval(this.refresh, 1000);
    },
    beforeUnmount() {
        clearInterval(this.timer);
    },
};
</script>

<style scoped>
.auth-countdown {
    font-size: 0.6em;
    font-weight: 400;
    opacity: 0.8;
    white-space: nowrap;
}

.auth-countdown.expired {
    color: #d9534f;
    opacity: 1;
}
</style>
