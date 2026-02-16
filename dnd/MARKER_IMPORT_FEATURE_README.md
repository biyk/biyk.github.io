# Marker Import Feature Documentation

## Overview
This feature allows users to import markers from other maps into the current map. Similar to the initiative import functionality, users can select a map, choose a marker from that map, and then place it on the current map.

## New UI Elements

### Marker Menu Enhancement
The existing marker menu (accessed via the "Marker" button) now includes a new section:

```html
<h4>Добавить маркер из другой карты</h4>
<div class="map-selection">
    <label>Выберите карту: 
        <select id="marker-map-select">
            <option value="">Выберите карту...</option>
        </select>
    </label>
</div>
<div class="marker-selection" id="marker-selection" style="display: none;">
    <label>Выберите маркер: 
        <select id="marker-select">
            <option value="">Выберите маркер...</option>
        </select>
    </label>
    <button id="add-marker-from-map-button" class="add-button">[+] Добавить</button>
</div>
```

## Technical Implementation

### Files Modified

#### 1. `static/js/marker.js`
- **Added import**: `import {GoogleSheetDB, ORM, spreadsheetId, Table} from "./db/google.js";`
- **Enhanced `initializeMarkerMenu()`**: Added new form elements for map and marker selection
- **New HTML structure**: Added the marker import form to the existing marker menu

#### 2. `static/js/script.js`
- **Enhanced map click handler**: Modified to handle imported marker data with additional properties
- **New methods added to MapManager class**:
  - `loadMapsList()`: Loads available maps from Google Sheets
  - `loadMarkersFromMap(mapName)`: Loads markers from selected map
  - `addMarkerFromMap()`: Handles marker selection and enters placement mode
- **Enhanced event listeners**: Added event delegation for dynamic elements

#### 3. `static/css/styles/marker.css`
- **New styles**: Added CSS for the marker import form elements
- **Consistent styling**: Matches the existing marker menu design

### Key Methods

#### `loadMapsList()`
```javascript
async loadMapsList() {
    // Fetches available maps from Google Sheets
    // Populates the map selection dropdown
}
```

#### `loadMarkersFromMap(mapName)`
```javascript
async loadMarkersFromMap(mapName) {
    // Fetches markers from the selected map
    // Populates the marker selection dropdown
    // Shows/hides the marker selection section
}
```

#### `addMarkerFromMap()`
```javascript
async addMarkerFromMap() {
    // Parses selected marker data
    // Sets up placement mode
    // Hides marker menu
    // Disables polygon clickability
}
```

## User Workflow

1. **Open Marker Menu**: Click the "Marker" button to open the marker menu
2. **Select Map**: Choose a map from the dropdown (automatically loads available maps)
3. **Select Marker**: Choose a marker from the selected map (shows marker details)
4. **Enter Placement Mode**: Click "[+] Добавить" to enter placement mode
5. **Place Marker**: Click on the map to place the selected marker
6. **Complete**: Marker is placed and menu returns to normal state

## Data Flow

1. **Map Selection**: 
   - Fetches map list from `KEYS` and `MAPS` tables in Google Sheets
   - Populates dropdown with available maps

2. **Marker Loading**:
   - Fetches marker data from selected map's table
   - Displays markers with emoji, name, and number
   - Stores full marker settings as JSON in option value

3. **Marker Placement**:
   - Parses selected marker settings
   - Sets `selectedIcon` and `selectedMarkerData` properties
   - Enters placement mode (disables polygon interactions)
   - Places marker on map click with all original properties

## Error Handling

- **Network errors**: Console logging for debugging
- **Invalid data**: Graceful fallbacks and user alerts
- **Missing elements**: Null checks before DOM manipulation

## CSS Styling

The new form elements use consistent styling with the existing marker menu:

```css
.marker-menu h4 {
    margin: 10px 0 5px 0;
    color: #2c3e50;
    font-size: 14px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 5px;
}

.marker-menu .add-button {
    background-color: #28a745;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    transition: background-color 0.2s;
    font-weight: bold;
    font-size: 12px;
    margin-top: 5px;
}
```

## Testing

A test file `test_marker_import.html` is provided to verify the UI functionality with mock data.

## Dependencies

- Google Sheets API integration (`GoogleSheetDB`, `Table` classes)
- Existing marker system (`drowMarker`, `points` collection)
- Map management system (`MapManager` class)

## Integration Points

- **Marker System**: Integrates with existing `drowMarker()` function
- **Data Persistence**: Uses existing `sendData('markers')` for saving
- **UI Consistency**: Follows existing marker menu patterns
- **Event Handling**: Uses event delegation for dynamic elements

## Future Enhancements

- Batch marker import
- Marker filtering/search
- Preview of marker appearance
- Undo/redo functionality for imported markers
