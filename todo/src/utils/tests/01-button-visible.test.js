export default {
    name: 'Б1.1 Доступность кнопки «Тесты»',
    async run(ctx) {
        const root = ctx.$el || document;
        const button = Array.from(root.querySelectorAll('button'))
            .find(b => b.textContent.trim() === 'Тесты');
        return {
            passed: !!button,
            details: button ? 'Кнопка «Тесты» найдена' : 'Кнопка «Тесты» не найдена в DOM'
        };
    }
};
