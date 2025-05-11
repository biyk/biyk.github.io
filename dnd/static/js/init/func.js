export function calculateEncounterData(characters) {
    const ENCOUNTER_EASY = 0,
          ENCOUNTER_MEDIUM = 1,
          ENCOUNTER_HARD = 2,
          ENCOUNTER_DEADLY = 3;

    const xpThresholdsByLevel = {
        1: [25, 50, 75, 100],
        2: [50, 100, 150, 200],
        3: [75, 150, 225, 400],
        4: [125, 250, 375, 500],
        5: [250, 500, 750, 1100],
        6: [300, 600, 900, 1400],
        7: [350, 750, 1100, 1700],
        8: [450, 900, 1400, 2100],
        9: [550, 1100, 1600, 2400],
        10: [600, 1200, 1900, 2800],
        11: [800, 1600, 2400, 3600],
        12: [1000, 2000, 3000, 4500],
        13: [1100, 2200, 3400, 5100],
        14: [1250, 2500, 3800, 5700],
        15: [1400, 2800, 4300, 6400],
        16: [1600, 3200, 4800, 7200],
        17: [2000, 3900, 5900, 8800],
        18: [2100, 4200, 6300, 9500],
        19: [2400, 4900, 7300, 10900],
        20: [2800, 5700, 8500, 12700]
    };

    const danger = {
        "0": 10,
        "1/8": 25, "1/4": 50, "1/2": 100,
        "0.125": 25, "0.25": 50, "0.5": 100,
        "1": 200, "2": 450, "3": 700, "4": 1100,
        "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200,
        "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000,
        "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
        "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000,
        "30": 155000
    };

    // Массив множителей на основе количества врагов
    const factor = [1, 1.5, 2, 2.5, 3, 4];

    let playerTotal = 0;
    let masterTotal = 0;
    let totalExp = 0;
    let difficultyThresholds = [0, 0, 0, 0];
    let encounterDifficulty = 0;

    // 1. Рассчитываем пороги сложности для всей группы
    characters.forEach(character => {
        const isNpc = character.npc === "true";
        const levelOrDanger = parseInt(character.exp);

        if (isNpc) {
            // Увеличиваем количество врагов и суммарный опыт врагов
            masterTotal += 1;
            totalExp += danger[levelOrDanger] || 0;
        } else {
            // Увеличиваем пороговые значения сложности отряда на основе уровня игрока
            playerTotal += 1;
            if (xpThresholdsByLevel[levelOrDanger]) {
                difficultyThresholds[ENCOUNTER_EASY] += xpThresholdsByLevel[levelOrDanger][ENCOUNTER_EASY];
                difficultyThresholds[ENCOUNTER_MEDIUM] += xpThresholdsByLevel[levelOrDanger][ENCOUNTER_MEDIUM];
                difficultyThresholds[ENCOUNTER_HARD] += xpThresholdsByLevel[levelOrDanger][ENCOUNTER_HARD];
                difficultyThresholds[ENCOUNTER_DEADLY] += xpThresholdsByLevel[levelOrDanger][ENCOUNTER_DEADLY];
            }
        }
    });

    // 2. Определение множителя сложности
    let factorId;
    if (masterTotal === 1) {
        factorId = 1;
    } else if (masterTotal === 2) {
        factorId = 1.5;
    } else if (masterTotal >= 3 && masterTotal <= 6) {
        factorId = 2;
    } else if (masterTotal >= 7 && masterTotal <= 10) {
        factorId = 2.5;
    } else if (masterTotal >= 11 && masterTotal <= 14) {
        factorId = 3;
    } else {
        factorId = 4;
    }

    // Корректируем множитель для малых или больших групп
    if (playerTotal < 3) {
        factorId = Math.min(factorId + 1, 4); // применяем следующий множитель
    } else if (playerTotal >= 6) {
        factorId = Math.max(factorId - 1, 0.5); // предыдущий множитель
    }

    // 3. Рассчитываем итоговый опыт с учетом множителя
    const adjustedExp = totalExp * factorId;

    // 4. Определяем уровень сложности на основе суммарного опыта врагов
    if (adjustedExp <= difficultyThresholds[ENCOUNTER_EASY]) {
        encounterDifficulty = ENCOUNTER_EASY;
    } else if (adjustedExp <= difficultyThresholds[ENCOUNTER_MEDIUM]) {
        encounterDifficulty = ENCOUNTER_MEDIUM;
    } else if (adjustedExp <= difficultyThresholds[ENCOUNTER_HARD]) {
        encounterDifficulty = ENCOUNTER_HARD;
    } else {
        encounterDifficulty = ENCOUNTER_DEADLY;
    }

    // Возвращаем пороги сложности, итоговую сложность, суммарный опыт и примененный множитель
    return {
        difficultyThresholds,
        encounterDifficulty,
        adjustedExp,
        factorId
    };
}


export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

export function createEditableSpan(content, property, index, callback, after='') {
    // Разделяем текст на лейбл и значение
    const [label, value] = content.split(': ');

    // Создаем span для лейбла, который будет неизменным
    const labelSpan = document.createElement('span');
    labelSpan.textContent = `${label}: `;

    // Создаем span для лейбла, который будет неизменным
    const afterSpan = document.createElement('span');
    afterSpan.textContent = after;

    // Создаем span для значения, которое будет редактируемым
    const valueSpan = document.createElement('span');
    valueSpan.textContent = value || '0'
    valueSpan.classList.add('editable-value');
    valueSpan.classList.add(property);
    valueSpan.onclick = () => {
        const newValue = window.prompt(`Введите новое значение для ${property}:`, valueSpan.textContent);
        if (newValue !== null) {
            valueSpan.textContent = newValue;
            callback(index, property, newValue);
        }
    };

    // Оборачиваем лейбл и значение в общий контейнер
    const containerSpan = document.createElement('span');
    containerSpan.append(labelSpan, valueSpan, afterSpan);

    return containerSpan;
}
