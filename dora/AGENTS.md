# AGENTS.md — ImDora

Vanilla JS SPA (SVG apartment plan editor + item inventory). Russian UI. No build tools.

## Quickstart
- Open `index.html` in any browser directly (no server needed)
- Data persists in `localStorage` (see Multi-plan storage below)
- Tests: `python tests/run_tests.py` (all), `--unit`, `--integration`, `--headless`

## Architecture

```
index.html  ← loads 12 scripts (dependency order)
├── js/core/     EventBus, DataStore (singleton), utils
├── js/ui/       Renderer (SVG), Ruler, GuideManager, ModalManager, PanelManager
├── js/interaction/  DragManager, SearchManager
└── js/io/       ExportImport
```

- **Global namespace**: all modules attach to `window.App` via IIFE closures. Never use `const App` or `let App` — always `window.App`.
- **Communication**: `App.EventBus` (observer pattern) — events: `data:changed`, `drag:start|moving|end`, `search:*`, `guide:*`, `room:*`, `object:*`, `container:*`, `item:*`, `plan:created|switched|renamed|deleted|listChanged`
- **Init order** (`js/app.js:App.init`): Ruler → Renderer → GuideManager → DragManager → Search → Modal → Panel. This sets SVG layer z-order (ruler bottom, plan middle, guides top).

## Multi-plan storage (`DataStore`)
Multiple apartments ("квартиры") are supported. Registry and active plan live in localStorage:
- `apartmentPlans` — JSON array `[{id, name}]` (plan registry)
- `apartmentPlanActive` — id of the active plan
- Plan data keys: legacy first plan uses `apartmentPlan`; all others use `apartmentPlan:<id>` (ids generated as `plan_*`, stable across renames)
- API: `listPlans()`, `getActivePlanId()`, `getActivePlanName()`, `createPlan(name)` (empty doc, auto-switch, rejects empty/duplicate names case-insensitively), `switchPlan(id)`, `renamePlan(id, name)`, `deletePlan(id)` (cannot delete the last one; deleting active switches to the first remaining), `registerCloudPlans(names)` (adds cloud-only names to registry)
- Events: `plan:created|switched|renamed|deleted|listChanged`. `plan:switched` is always followed by `data:changed`.

## Google Sheets sync (`js/app.js`)
- Spreadsheet id: `SPREADSHEET_ID` in app.js; sheet/tab `dora`, columns A:B
- **Row 1 is always the header `key | value`** — data rows start at row 2. All sync ops go through `_fetchPlanData()`/`_writePlanBlock()`: read whole block, split off the header, mutate data rows, rewrite the block with one `values.update`. Never use `deleteDimension` or index-based cell writes (`values` skips empty grid rows, so indices can shift)
- Each apartment = one data row keyed by current name (A), value = plan JSON (B)
- A data row counts as an apartment only if its B parses as a plan doc (`_isPlanDoc`: rooms+objects arrays) — stray labels in column A are ignored
- Export updates/creates the row of the ACTIVE plan (debounced on `data:changed`)
- On gapi auth: valid plan rows register into the registry, then content of the active row is imported
- On switch (if authorized): cloud row of the new active plan is imported; auto-export is suppressed during this import so an empty local copy cannot wipe cloud data
- Rename updates column A of the matching data row; delete removes the row only after content validation (non-plan payloads are kept and skipped, warning logged)

## Data Schema (per plan document)
```js
{ scale: 100, // px per meter
  rooms: [{ id, name, x, y, w, h, color? }],
  objects: [{ id, name, roomId: null|'r_X', parentId: null|'o_X', x, y, w, h, color,
              items: string[] }],
  guides: [{ id, orientation: 'horizontal'|'vertical', position }]
}
```
- Objects can be **nested**: `parentId: null` = root (drawn on SVG, has geometry), `parentId: 'o_X'` = nested (logical storage only, shown in panel, inherits `roomId` from parent).
- Items live **directly** on objects (`obj.items`). There are **no containers** — legacy `containers` are migrated into nested objects on import/`_validate`.
- `Renderer` draws only `getRootObjects()` (`parentId === null`). Nested objects are never rendered on SVG.
- `addObject()` with `parentId` inherits `roomId` from parent; root objects auto-detect room by spatial containment at creation if `roomId` not provided.
- `moveObjectInto(objectId, newParentId)` nests/detaches objects. Guards: rejects self-nesting and nesting into own descendant (cycle protection). `null` detaches to root and recomputes `roomId` by center coordinates.
- `moveItem(fromObjectId, fromIndex, toObjectId)` transfers an item between objects (splice + push). Guards: valid ids, integer index in range, source ≠ target. Emits `item:moved` + `data:changed`.
- **Canvas drag-drop nesting**: releasing a dragged root object with the cursor over another root object nests it (`DragManager` tracks `_state.dropTargetId`, target gets `.drop-target` green outline; highlight is applied AFTER `Renderer.render()` because render rebuilds the SVG DOM every mousemove frame).
- **Panel HTML5 dnd** (`PanelManager`, delegated listeners on `#panel-content` bound once in `init()` — panel innerHTML is rebuilt on every refresh): item rows are draggable (`data-drag-item="objId:idx"`), nested child rows are draggable + droppable (`data-drag-object` / `data-drop-object`), breadcrumb crumbs are drop targets (`data-drop-object`, «🏠 План» = `data-drop-root` detaches to root). Items cannot drop on root crumb.
- **Canvas item drop** (`DragManager`): an item dragged from the panel can be dropped onto a root object rect on the SVG — `_onCanvasDragOver`/`_onCanvasDrop` listen on the `<svg>`, target via `e.target.closest('[data-draggable]')` with `data-dtype="object"`, highlight `.drop-target`. Panel exposes the in-flight drag via `getActiveItemDrag()`/`clearItemDrag()`.
- `ModalManager.showMoveItem(objectId, itemIndex)` — fallback dialog («→» button on each item row) with hierarchical target select.
- `deleteObject()` only works on **empty** objects (no children, no items) — cascade delete is not supported.
- `moveObject()` skips room recomputation for nested objects (they have no geometry).
- Objects are **independent** from rooms — `moveRoom()` does NOT shift child objects; `deleteRoom()` does NOT delete objects.
- Search highlights the **root ancestor** of a matched nested object (`getRootAncestor`).

## SVG & Coordinates
- `viewBox="0 0 5000 3500"`, SVG `min-width: 5000px`, `min-height: 3500px`. Scale: **100px = 1m** (up to 50m).
- Plan content wrapped in `<g class="plan-wrap">` with CSS `transform="scale(z)"` for zoom. **Never change viewBox for zoom.**
- `transform-origin: 0 0` on `.plan-wrap` is required for correct zoom behavior.
- All coordinates `{ x, y, w, h }` in pixels (data space).
- `vector-effect="non-scaling-stroke"` on ruler, room/object rects, guide lines (borders don't scale with zoom).
- Snap threshold: **8px** (`DragManager.SNAP_THRESHOLD`).
- Room drag snaps to guides AND ruler grid (every `scale` px, default 100px = 1m).
- Object drag snaps to guides only.

## Zoom
- Range: 0.25 – 3.0, step 0.25 (`App.Config`).
- Applied via `transform="scale(z)"` on `.plan-wrap` group, NOT viewBox change.
- Resize handles rendered **outside** `.plan-wrap` (in `.resize-layer`), coordinates multiplied by `z` so they appear at correct screen position.
- `DragManager._onMouseMove` divides dx/dy by `z` for resize delta; GuideManager divides mouse coords by `z`.
- Snap positions always in data space (no zoom division needed).

## Drag & Drop / Resize
- SVG elements get `data-draggable="{id}" data-dtype="object"|"room"`.
- Resize handles: `data-resize="nw|n|ne|e|se|s|sw|w"`, `data-resize-target="{id}"`, `data-resize-type="object"|"room"`.
- Click (no drag) opens info panel via emulated click in `_onMouseUp` (checks `_state.moved` flag).
- **Never reference `ResizeManager`** — deleted, resize handled inside `DragManager`.

## Adding New Features
- Add module under `js/`, register `<script>` in `index.html` before `app.js`.
- Init in `App.init()` — order determines SVG layer z-order.
- All IDs via `App.utils.generateId(prefix)` (timestamp + random base36).
- CRUD in `DataStore` auto-persist to localStorage + emit `data:changed`.
- Color palette: 10 colors in `App.utils.COLORS`, pick via `App.utils.nextColor()`.

## Testing
- `tests/browser.py` — CDP browser launcher (Chrome DevTools Protocol via WebSocket). Class: `BrowserSession`.
- `tests/integration.py` — integration tests (render, zoom, drag, resize, guides, ruler, snap, dnd).
- `tests/run_tests.py` — runner entry point. Uses `BrowserSession` context manager.
- `tests.html` — unit tests (EventBus, utils, DataStore, ExportImport, guides, multi-plan, moveItem).
- Headless window: **1920×1080** via `Emulation.setDeviceMetricsOverride` so rooms at x=650+ are visible.
- Page scroll: `plan-container.scrollTo(600, 0)` in `inject_data()`.
- `inject_data()` also removes `apartmentPlans`/`apartmentPlanActive` keys so integration runs always boot into the legacy `plan`.
- **CDP mouse drags cannot start at negative viewport coords** — data x≈250 is off-screen after the (600,0) scroll. Tests that drag left-side elements must `plan-container.scrollTo(0, 0)` first and assert coords > 0.
- Panel dnd is tested via synthetic `DragEvent('dragstart'/'dragover'/'drop', {dataTransfer: new DataTransfer()})` dispatched on panel rows (bubbles to delegated listeners).

## Gotchas
- **Cache-busting**: all script/style tags in `index.html`/`tests.html` carry `?v=YYYYMMDDNN`. The pre-commit hook (`.githooks/pre-commit` → `tools/bump_dora_cache.py`) bumps them automatically when `dora/js/**` or `dora/style.css` is staged — do NOT bump manually. Stale-token symptom: Chrome silently serves old scripts and tests run outdated code (activate hooks after clone: `git config core.hooksPath .githooks`).
- **`apartmentPlanActive` is stored as a RAW string** (`setItem(ACTIVE_KEY, _activeId)`), not JSON — never `JSON.parse(localStorage.getItem('apartmentPlanActive'))`.
- **Guide creation**: toolbar buttons (`guide-h`/`guide-v`) set pending state + cursor change. User must **click on canvas** to place the guide. `Esc` cancels pending. Never create guides immediately on button press.
- **SVG layer z-order**: `plan-wrap` wraps `.ruler-layer`, `.plan-content`, `.guide-layer`. `.resize-layer` is appended to SVG after `plan-wrap`. New SVG layers must be appended in correct z-order.
- **GuideManager `_render`** listens to `guide:added`, `guide:removed`, `guide:updated`, `data:changed` — all cause re-render.
- **DataStore `_validate`** runs on init: ensures `rooms`, `objects`, `guides` are arrays; `scale` is positive number.
- **`utils.escapeHtml`** implemented in `utils.js` — use it for all user content in SVG/text.
- Do NOT add files outside `F:\ImDora`.
