# Marker Selection Feature Documentation

## Overview
This feature adds the ability to select multiple markers on the map using mouse selection, similar to file selection in operating systems. Users can select markers individually or by drawing a selection rectangle, and then perform group operations like moving all selected markers together.

## How to Use

### Activating Selection Mode
1. **Hold the Ctrl key** to activate selection mode
2. The cursor will change to a crosshair
3. A selection UI panel will appear in the top-right corner

### Selecting Markers

#### Individual Selection
- While holding Ctrl, **click on individual markers** to select/deselect them
- Selected markers will have a blue border and slight scale effect

#### Rectangle Selection
- While holding Ctrl, **click and drag** to create a selection rectangle
- All markers within the rectangle will be automatically selected
- Release the mouse button to complete the selection

### Group Operations

#### Moving Selected Markers
- **Drag any selected marker** to move all selected markers together
- The markers maintain their relative positions during group movement
- Changes are automatically saved

#### Other Operations
- Use the **"Clear Selection"** button to deselect all markers
- Use the **"Delete Selected"** button to remove all selected markers (with confirmation)

### Visual Feedback
- **Selected markers**: Blue border with glow effect and slight scale increase
- **Selection mode**: Crosshair cursor
- **Selection UI**: Shows count of selected markers and action buttons
- **Selection rectangle**: Blue semi-transparent rectangle during selection

## Technical Implementation

### Files Modified

#### 1. `static/js/marker.js`
- **Added global variables** for selection state management
- **Enhanced `drowMarker()` function** with selection event handlers
- **New functions**:
  - `toggleMarkerSelection()`: Toggle individual marker selection
  - `clearSelection()`: Clear all selections
  - `updateSelectionDisplay()`: Update UI counters
  - `initializeSelectionMode()`: Setup keyboard and mouse handlers
  - `showSelectionUI()` / `hideSelectionUI()`: Manage selection interface
  - `deleteSelectedMarkers()`: Group deletion functionality

#### 2. `static/css/styles/marker.css`
- **Added styles for selected markers**: Blue border, glow effect, scale transform
- **Selection mode styles**: Crosshair cursor
- **Selection UI styles**: Fixed position panel with controls
- **Selection hint styles**: Informational text styling

#### 3. `static/js/script.js`
- **Added import** for `initializeSelectionMode`
- **Added initialization call** in `initMap()` method

#### 4. `admin.html`
- **Added selection hint** in map controls section

### Key Features

#### Selection State Management
- Uses `Set` for efficient marker ID tracking
- Global state variables for selection mode and UI state
- Proper cleanup when exiting selection mode

#### Event Handling
- **Keyboard events**: Ctrl key detection for mode switching
- **Mouse events**: Click, drag, and rectangle selection
- **Marker events**: Individual selection and group dragging

#### Group Dragging
- Calculates delta movement from dragged marker
- Applies same delta to all selected markers
- Maintains relative positions during movement
- Automatic saving of position changes

#### UI Integration
- Non-intrusive selection interface
- Real-time counter updates
- Contextual action buttons
- Visual feedback for all states

## Browser Compatibility
- Works with all modern browsers supporting ES6 features
- Requires Leaflet.js for map functionality
- Uses standard DOM APIs for event handling

## Performance Considerations
- Efficient marker lookup using Map data structure
- Minimal DOM manipulation during selection
- Event delegation for dynamic elements
- Proper cleanup to prevent memory leaks

## Future Enhancements
- Copy/paste functionality for selected markers
- Bulk property editing (color, text, etc.)
- Selection persistence across sessions
- Keyboard shortcuts for common operations
- Undo/redo for group operations
