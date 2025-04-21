export function initializeMarkers(){
    let config = this.config;
    let map = this.map;
}

export class SlideMenu {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.markers = [];
    }
    toggle() {
        const sidebar = document.createElement('div');
        sidebar.style.right = sidebar.style.right === '0px' ? '-33%' : '0px';
    }

    initializeMapMarkers(map) {

    }

    startAdding(type) {
        this.toggle();
        window.mapManager.map.once('click', e => {
            const marker = L.marker(e.latlng, { draggable: type === 'draggable' }).addTo(window.mapManager.map);
            marker.bindPopup(`
           ${type} marker
           <button onclick="window.SlideMenu.removeMarker(${this.markers.length})">Remove</button>
         `);
            this.markers.push(marker);
        });
    }
    removeMarker(index) {
        const marker = this.markers[index];
        if (marker) {
            window.mapManager.map.removeLayer(marker);
            this.markers.splice(index, 1);
        }
    }
}

window.SlideMenu =  new SlideMenu();