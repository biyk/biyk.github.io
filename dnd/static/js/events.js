export class MyEvents {
    constructor() {
        window.logger = window.logger || this;
    }
    start(code) {
        const event = new CustomEvent("myevent-start", {
            detail: { code },
            bubbles: true,
        });
        document.body.dispatchEvent(event);
    }

    stop(code) {
        const event = new CustomEvent("myevent-stop", {
            detail: { code },
            bubbles: true,
        });
        document.body.dispatchEvent(event);
    }
}

// Класс: визуальный обработчик событий
export class EventDisplay {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'event-display-container';
        document.body.appendChild(this.container);
        this.activeEvents = new Map();

        // Подписка на события
        document.body.addEventListener('myevent-start', (e) => {
            this.showStart(e.detail.code);
        });

        document.body.addEventListener('myevent-stop', (e) => {
            this.showStop(e.detail.code);
        });
    }

    showStart(code) {
        const div = document.createElement('div');
        div.className = 'event-item';
        div.textContent = `${code} loading`;
        this.container.appendChild(div);
        this.activeEvents.set(code, div);
    }

    showStop(code) {
        const div = this.activeEvents.get(code);
        if (div) {
            div.textContent = `${code} Ok`;
            setTimeout(() => {
                this.container.removeChild(div);
                this.activeEvents.delete(code);
            }, 3000);
        }
    }
}