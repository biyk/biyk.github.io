export class Settings {
    constructor(settings = {}) {
        this.show_grid = settings.show_grid || false;
        this.initHandlers()
        this.Listner = document.body;
    }

    initHandlers() {
        let show_grid = document.getElementById('settings-show-grid');
        if (show_grid) {
            show_grid.checked = this.show_grid;
            show_grid.addEventListener('change', () => {
                this.show_grid = show_grid.checked;
                this.Listner.dispatchEvent(new CustomEvent('update_config', {detail: {type: 'settings'}}));
            });
        };


        let admin_mode = document.getElementById('settings-admin-mode');
        if (!admin_mode) return false;
        admin_mode.checked = window.admin_mode;
        admin_mode.addEventListener('change', () => {
            window.admin_mode = admin_mode.checked;
            this.Listner.dispatchEvent(new Event('admin_mode'));
        });
    }

    updateSettings(settings = {}) {
        this.show_grid = settings.show_grid || false;
    }
}