
export function createPolygons(config) {
    this.polygons.forEach(polygon => this.map.removeLayer(polygon.layer));
    this.polygons = [];
    if (config.polygons){
        config.polygons.forEach(polygonData => {
            const polygonLayer = L.polygon(polygonData.points, {
                color: 'black',
                fillColor: 'black',
                fillOpacity: polygonData.isVisible ? 1.0 : 0.0,
                opacity: polygonData.isVisible ? 1.0 : 0.0,
                weight: 1,
            }).addTo(this.map);
            polygonLayer.isVisible = polygonData.isVisible;
            polygonLayer.clickHandler = this.createPolygonClickHandler(polygonLayer);
            polygonLayer.on('click', polygonLayer.clickHandler);
            this.polygons.push({
                layer: polygonLayer,
                points: polygonData.points,
                code: polygonData.code,
                isVisible: polygonLayer.isVisible,
            });
        });
    }

    if (config.mainPolygon?.points) {
        if (this.mainPolygon) this.map.removeLayer(this.mainPolygon);
        let hide = window.admin_mode ? 0.7 : 1.0;
        this.mainPolygon = L.polygon(config.mainPolygon.points, {
            color: 'black',
            fillColor: 'black',
            fillOpacity: hide,
            weight: 3,
        }).addTo(this.map);
    }
}

export function toggleMainPolygonVisibility() {
    if (this.map.hasLayer(this.mainPolygon)) {
        this.map.removeLayer(this.mainPolygon);
    } else {
        this.mainPolygon.addTo(this.map);
    }
}

export function createMainPolygon(config) {
    const bounds = this.map.getBounds();
    const polygonPoints = [
        [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
        [bounds.getSouthWest().lat, bounds.getNorthEast().lng],
        [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
        [bounds.getNorthEast().lat, bounds.getSouthWest().lng],
    ];
    let holes = [];
    config.polygons.forEach(polygonData => {
        holes.push(polygonData.points);
    });
    this.mainPolygon = L.polygon([polygonPoints, holes], {
        color: 'black',
        fillColor: 'black',
        fillOpacity: 1,
        weight: 3,
    }).addTo(this.map);
}

export function updateMainPolygon(config) {
    let holes = [];
    config.polygons.forEach(polygonData => {
        holes.push(polygonData.points);
    });
    this.mainPolygon.setLatLngs([this.mainPolygon.getLatLngs()[0], holes]);
}

export function setPolygonClickability(clickable) {
    this.polygons.forEach(polygon => {
        if (clickable) {
            polygon.layer.on('click', polygon.layer.clickHandler);
        } else {
            polygon.layer.off('click', polygon.layer.clickHandler);
        }
    });
}

