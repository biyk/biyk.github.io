import {getFreeSlots} from "../../utils/calendar.js";

function pad(n) {
    return String(n).padStart(2, '0');
}

export default {
    name: 'Б1.4.11 Calendar: TZ и ночной сценарий 00:00–04:00 (фикс #13)',
    async run() {
        const now = new Date();
        const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const events = [
            { start: { dateTime: `${day}T00:00:00` }, end: { dateTime: `${day}T00:30:00` } },
            { start: { dateTime: `${day}T02:00:00` }, end: { dateTime: `${day}T04:00:00` } },
        ];
        console.log('[Б1.4.11] Ночные события:', JSON.stringify(events));

        let slots;
        try {
            slots = getFreeSlots(events);
        } catch (e) {
            console.error('[Б1.4.11] Исключение:', e);
            return { passed: false, details: 'Исключение: ' + e.message };
        }

        if (!Array.isArray(slots)) return { passed: false, details: 'getFreeSlots вернул не массив' };

        const problems = [];
        for (const slot of slots) {
            if (slot.duration < 15) problems.push(`слот ${slot.start} короче 15 мин (${slot.duration})`);
            if (!(new Date(slot.start) < new Date(slot.end))) problems.push(`слот ${slot.start}..${slot.end} инвертирован`);
        }
        console.log('[Б1.4.11] Слотов:', slots.length, JSON.stringify(slots));
        return {
            passed: problems.length === 0,
            details: problems.length === 0
                ? `Ночные события (00:00–04:00) обработаны без ошибок, слотов: ${slots.length}`
                : problems.join('; ')
        };
    }
};
