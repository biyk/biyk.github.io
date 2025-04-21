class FaerunCalendar {
    constructor() {
        this.months = [
            {
                nameEn: "Hammer",
                nameRu: "Хаммер (Hammer)",
                nicknameEn: "Deepwinter",
                nicknameRu: "Разгар зимы (Deepwinter)",
                days: 30
            },
            {
                nameEn: "Alturiak",
                nameRu: "Альтуриак (Alturiak)",
                nicknameEn: "The Claw of Winter",
                nicknameRu: "Коготь зимы (The Claw of Winter)",
                days: 30
            },
            {
                nameEn: "Ches",
                nameRu: "Чес (Ches)",
                nicknameEn: "of the Sunsets",
                nicknameRu: "Месяц закатов (of the Sunsets)",
                days: 30
            },
            {
                nameEn: "Tarsakh",
                nameRu: "Тарсах (Tarsakh)",
                nicknameEn: "of the Storms",
                nicknameRu: "Месяц гроз (of the Storms)",
                days: 30
            },
            {
                nameEn: "Mirtul",
                nameRu: "Миртул (Mirtul)",
                nicknameEn: "The Melting",
                nicknameRu: "Месяц таяния снегов (The Melting)",
                days: 30
            },
            {
                nameEn: "Kythorn",
                nameRu: "Киторн (Kythorn)",
                nicknameEn: "The Time of Flowers",
                nicknameRu: "Время цветов (The Time of Flowers)",
                days: 30
            },
            {
                nameEn: "Flamerule",
                nameRu: "Флеймрул (Flamerule)",
                nicknameEn: "Summertide",
                nicknameRu: "Разгар лета (Summertide)",
                days: 30
            },
            {
                nameEn: "Elesias",
                nameRu: "Элесиас (Elesias)",
                nicknameEn: "Highsun",
                nicknameRu: "Солнце в зените (Highsun)",
                days: 30
            },
            {
                nameEn: "Eleint",
                nameRu: "Элейнт (Eleint)",
                nicknameEn: "The Fading",
                nicknameRu: "Угасание (The Fading)",
                days: 30
            },
            {
                nameEn: "Marpenoth",
                nameRu: "Марпенот (Marpenoth)",
                nicknameEn: "Leaffall",
                nicknameRu: "Листопад (Leaffall)",
                days: 30
            },
            {
                nameEn: "Uktar",
                nameRu: "Уктар (Uktar)",
                nicknameEn: "The Rotting",
                nicknameRu: "Умирание (The Rotting)",
                days: 30
            },
            {
                nameEn: "Nightal",
                nameRu: "Найтол (Nightal)",
                nicknameEn: "The Drawing Down",
                nicknameRu: "Завершение года (The Drawing Down)",
                days: 30
            },
        ];

        this.specialDays = [
            { nameEn: "Midwinter", nameRu: "Макушка зимы (Midwinter)", dayOfYear: 31 },
            { nameEn: "Greengrass", nameRu: "День Зеленой травы (Greengrass)", dayOfYear: 122 },
            { nameEn: "Midsummer", nameRu: "Солнцеворот (Midsummer)", dayOfYear: 213 },
            { nameEn: "Shieldmeet", nameRu: "День Щитового схода (Shieldmeet)", dayOfYear: 214 },
            { nameEn: "Highharvestide", nameRu: "Праздник урожая (Highharvestide)", dayOfYear: 274 },
            { nameEn: "The Feast of the Moon", nameRu: "Пир Луны (The Feast of the Moon)", dayOfYear: 334 },
        ];

        this.daysInYear = 365;
        this.currentDayOfYear = 1;
        this.currentYear = 1372;
        this.format = "nameRu"; // Настройка формата вывода: nameRu, nameEn, nicknameRu, nicknameEn
    }

    setFormat(format) {
        const validFormats = ["nameRu", "nameEn", "nicknameRu", "nicknameEn"];
        if (!validFormats.includes(format)) {
            throw new Error("Invalid format. Choose one of: " + validFormats.join(", "));
        }
        this.format = format;
    }

    getCurrentDay() {
        return this.currentDayOfYear;
    }

    getCurrentYear() {
        return this.currentYear;
    }

    getCurrentMonth() {
        let remainingDays = this.currentDayOfYear;
        for (const month of this.months) {
            if (remainingDays <= month.days) {
                return month[this.format];
            }
            remainingDays -= month.days;
        }

        const specialDay = this.specialDays.find(day => day.dayOfYear === this.currentDayOfYear);
        if (specialDay) {
            return specialDay[this.format];
        }

        return null;
    }

    calculateDate(offset) {
        let newDayOfYear = (this.currentDayOfYear + offset) % this.daysInYear;
        if (newDayOfYear <= 0) newDayOfYear += this.daysInYear;

        let newYear = this.currentYear + Math.floor((this.currentDayOfYear + offset) / this.daysInYear);
        return this.getDateFromDayOfYear(newDayOfYear, newYear);
    }

    getDateInFuture(days) {
        return this.calculateDate(days);
    }

    getDateInPast(days) {
        return this.calculateDate(-days);
    }

    getDateFromDayOfYear(dayOfYear, year) {
        let remainingDays = dayOfYear;
        for (const month of this.months) {
            if (remainingDays <= month.days) {
                return { day: remainingDays, month: month[this.format], year };
            }
            remainingDays -= month.days;
        }

        const specialDay = this.specialDays.find(day => day.dayOfYear === dayOfYear);
        if (specialDay) {
            return { day: specialDay[this.format], month: null, year };
        }

        return null;
    }

    setCurrentDate(dayOfYear, year) {
        if (dayOfYear < 1 || dayOfYear > this.daysInYear) {
            throw new Error("Invalid day of the year.");
        }
        this.currentDayOfYear = dayOfYear;
        this.currentYear = year;
    }
}

// Пример использования
const faerunCalendar = new FaerunCalendar();
faerunCalendar.setCurrentDate(45, 1372); // Устанавливаем 45-й день 1372 года
faerunCalendar.setFormat("nameRu"); // Устанавливаем формат вывода на русский (официальное название)

console.log(faerunCalendar.getCurrentDay()); // Текущий день
console.log(faerunCalendar.getCurrentMonth()); // Текущий месяц в выбранном формате
console.log(faerunCalendar.getDateInFuture(50)); // Дата через 50 дней
console.log(faerunCalendar.getDateInPast(30)); // Дата 30 дней назад