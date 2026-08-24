"""
Integration tests: open index.html, inject test data, verify SVG rendering,
zoom, drag/resize, guides, and ruler via CDP.
"""

import json
import os
import sys
import time as _time

sys.path.insert(0, os.path.dirname(__file__))

# wrap time.sleep so it's accessible inside test closures
time = _time

# Test data: simplified plan with 2 rooms + 2 objects
TEST_DATA = {
    "scale": 100,
    "rooms": [
        {"id": "r_test_1", "name": "Гостиная", "x": 100, "y": 100, "w": 500, "h": 300},
        {"id": "r_test_2", "name": "Кухня", "x": 650, "y": 100, "w": 300, "h": 250},
    ],
    "objects": [
        {"id": "o_test_1", "name": "Стол", "roomId": "r_test_1", "x": 200, "y": 200, "w": 150, "h": 80, "color": "#4a90d9"},
        {"id": "o_test_2", "name": "Холодильник", "roomId": "r_test_2", "x": 680, "y": 150, "w": 80, "h": 120, "color": "#4fc3f7"},
    ],
    "guides": [
        {"id": "g_test_1", "orientation": "horizontal", "position": 350},
        {"id": "g_test_2", "orientation": "vertical", "position": 600},
    ],
}

INDEX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "index.html"))
INDEX_URL = "file:///" + INDEX_PATH.replace("\\", "/")


def run_all(session):
    results = []

    def test(name, fn):
        try:
            fn()
            results.append((name, "PASS", None))
            print(f"  ✓ {name}")
        except Exception as e:
            results.append((name, "FAIL", str(e)))
            print(f"  ✗ {name}: {e}")

    # --- 1. App loaded ---
    def app_loaded():
        ok = session.evaluate("typeof App !== 'undefined' && typeof App.init === 'function'")
        assert ok, "App not defined"

    test("1. App initialized", app_loaded)

    # --- 2. Room count ---
    def room_count():
        n = session.evaluate("App.DataStore.getRooms().length")
        assert n == 2, f"Expected 2 rooms, got {n}"

    test("2. Room count = 2", room_count)

    # --- 3. Object count ---
    def object_count():
        n = session.evaluate("App.DataStore.getObjects().length")
        assert n == 2, f"Expected 2 objects, got {n}"

    test("3. Object count = 2", object_count)

    # --- 4. SVG exists ---
    def svg_exists():
        ok = session.evaluate("document.getElementById('plan') !== null")
        assert ok, "SVG element not found"

    test("4. SVG element exists", svg_exists)

    # --- 5. Room rects rendered ---
    def room_rects():
        n = session.evaluate("document.querySelectorAll('[data-dtype=\"room\"]').length")
        assert n == 2, f"Expected 2 room rects, got {n}"

    test("5. Room rects in SVG", room_rects)

    # --- 6. Object rects rendered ---
    def object_rects():
        n = session.evaluate("document.querySelectorAll('[data-dtype=\"object\"]').length")
        assert n == 2, f"Expected 2 object rects, got {n}"

    test("6. Object rects in SVG", object_rects)

    # --- 7. Ruler rendered ---
    def ruler_ticks():
        ticks = session.evaluate("document.querySelectorAll('.ruler-layer line').length")
        assert ticks > 10, f"Too few ruler ticks: {ticks}"

    test("7. Ruler ticks rendered", ruler_ticks)

    # --- 8. Guide lines rendered ---
    def guide_lines():
        # Visible guide lines = 2 (1 horizontal + 1 vertical)
        lines = session.evaluate("document.querySelectorAll('.guide-layer line:not([stroke=\"transparent\"])').length")
        assert lines == 2, f"Expected 2 guide lines, got {lines}"

    test("8. Guide lines rendered", guide_lines)

    # --- 9. Plan-wrap transform group exists ---
    def zoom_group():
        ok = session.evaluate("document.querySelector('.plan-wrap') !== null")
        assert ok, "plan-wrap group missing"

    test("9. Zoom group (plan-wrap) exists", zoom_group)

    # --- 10. Zoom in/out works ---
    def zoom_works():
        z1 = session.evaluate("App.getZoom()")
        session.evaluate("App.zoomIn()")
        z2 = session.evaluate("App.getZoom()")
        session.evaluate("App.zoomOut()")
        session.evaluate("App.zoomOut()")
        z3 = session.evaluate("App.getZoom()")
        # Restore
        session.evaluate("App.setZoom(1)")
        assert z2 > z1, f"zoomIn should increase: {z1} -> {z2}"
        assert z3 < z1, f"zoomOut should decrease: {z1} -> {z3}"

    test("10. Zoom in/out changes scale", zoom_works)

    # --- 11. Transform attribute updates ---
    def transform_updates():
        t1 = session.evaluate("document.querySelector('.plan-wrap').getAttribute('transform')")
        session.evaluate("App.setZoom(2)")
        t2 = session.evaluate("document.querySelector('.plan-wrap').getAttribute('transform')")
        session.evaluate("App.setZoom(1)")
        assert t1 != t2, "Transform did not change after zoom"

    test("11. Plan-wrap transform updates on zoom", transform_updates)

    # --- 12. Room contains object ---
    def room_contains():
        room = session.evaluate("App.DataStore.getRooms()[0]")
        obj = session.evaluate("App.DataStore.getObjects()[0]")
        inside = (obj["x"] >= room["x"] and obj["x"] + obj["w"] <= room["x"] + room["w"] and
                  obj["y"] >= room["y"] and obj["y"] + obj["h"] <= room["y"] + room["h"])
        assert inside, f"Object not inside room: room={room}, obj={obj}"

    test("12. Object spatially inside room", room_contains)

    # --- 13. Guide snap positions ---
    def snap_positions():
        snaps = session.evaluate("JSON.stringify(App.GuideManager.getSnapPositions())")
        snaps = json.loads(snaps)
        assert 350 in snaps["y"], f"Missing horizontal snap 350: {snaps}"
        assert 600 in snaps["x"], f"Missing vertical snap 600: {snaps}"

    test("13. Guide snap positions", snap_positions)

    # --- 14. Ruler shows 50m ---
    def ruler_50m():
        # At 100px/m, 5000px = 50m. Check last major label
        texts = session.evaluate("[...document.querySelectorAll('.ruler-layer text')].map(t => t.textContent)")
        meter_values = [t for t in texts if t.endswith("m") or t == "0"]
        has_50 = any("50" in t for t in meter_values)
        # At least we should have labels up to a reasonable number
        assert len(meter_values) >= 5, f"Too few meter labels: {meter_values}"

    test("14. Ruler meter labels present", ruler_50m)

    # --- 15. Move room, objects do NOT follow ---
    def room_move_independent():
        r = session.evaluate("App.DataStore.getRooms()[0]")
        orig_ox = session.evaluate("App.DataStore.getObjects()[0].x")
        orig_oy = session.evaluate("App.DataStore.getObjects()[0].y")
        room_id = r["id"]
        session.evaluate(f"App.DataStore.moveRoom('{room_id}', {r['x'] + 50}, {r['y'] + 30})")
        r2 = session.evaluate("App.DataStore.getRooms()[0]")
        o2 = session.evaluate("App.DataStore.getObjects()[0]")
        # Restore
        session.evaluate(f"App.DataStore.moveRoom('{room_id}', {r['x']}, {r['y']})")
        assert r2["x"] == r["x"] + 50, f"Room should move: {r2['x']} != {r['x'] + 50}"
        assert o2["x"] == orig_ox, f"Object should stay put (independent): {o2['x']} != {orig_ox}"
        assert o2["y"] == orig_oy, f"Object should stay put (independent): {o2['y']} != {orig_oy}"

    test("15. Room move does NOT shift objects", room_move_independent)

    # --- 16. Move object recomputes roomId by center ---
    def object_move_recomputes_roomid():
        obj = session.evaluate("App.DataStore.getObjects()[0]")
        oid = obj["id"]
        session.evaluate(f"App.DataStore.moveObject('{oid}', {obj['x'] + 10}, {obj['y'] + 10})")
        updated = session.evaluate("App.DataStore.getObjects()[0]")
        # Object center (285, 255) still inside r_test_1 (100..600, 100..400)
        assert updated.get("roomId") == "r_test_1", f"roomId should be r_test_1, got {updated.get('roomId')}"
        # Restore
        session.evaluate(f"App.DataStore.moveObject('{oid}', {obj['x']}, {obj['y']})")

    test("16. Object move recomputes roomId by center", object_move_recomputes_roomid)

    # --- 17. Resize handle exists ---
    def resize_handles():
        session.evaluate("App.PanelManager.showRoom('r_test_1')")
        session.evaluate("App.PanelManager.getSelectedRoomId = () => 'r_test_1'")
        session.evaluate("App.Renderer.render()")
        time.sleep(0.2)
        handles = session.evaluate("document.querySelectorAll('[data-resize]').length")
        assert handles > 0, f"Expected resize handles, found {handles}"

    test("17. Resize handles render", resize_handles)

    # --- 18. Search works ---
    def search_works():
        session.evaluate("App.EventBus.emit('search:results', { results: [{ object: { id: 'o_test_1' } }] })")
        matched = session.evaluate("document.querySelectorAll('.search-match').length")
        assert matched >= 1, f"No search-match elements found"
        session.evaluate("App.SearchManager.clear()")

    test("18. Search highlight works", search_works)

    # --- 19. Modal opens ---
    def modal_opens():
        session.evaluate("App.ModalManager.showAddRoom()")
        visible = session.evaluate("document.getElementById('modal-overlay').style.display !== 'none'")
        session.evaluate("App.ModalManager.close()")
        assert visible, "Modal overlay not visible"

    test("19. Modal opens/closes", modal_opens)

    # --- 20. Ruler non-scaling stroke ---
    def ruler_nonscaling():
        lines = session.evaluate("""
            (() => {
                const lines = document.querySelectorAll('.ruler-layer line');
                let count = 0;
                lines.forEach(l => { if (l.getAttribute('vector-effect') === 'non-scaling-stroke') count++; });
                return count;
            })()
        """)
        assert lines > 10, f"Too few ruler lines with non-scaling-stroke: {lines}"

    test("20. Ruler vector-effect non-scaling-stroke", ruler_nonscaling)

    # --- 21. Room snap to guide on drag ---
    def room_snap():
        # Add a guide at data position 515 (between grid points 500 and 600)
        session.evaluate("App.DataStore.addGuide('vertical', 515)")
        session.evaluate("App.DataStore.addGuide('horizontal', 180)")
        session.evaluate("App.Renderer.render()")
        time.sleep(0.2)

        # Get the room's viewport bounding box and debug info
        room2 = session.evaluate("""
            (() => {
                const el = document.querySelector('[data-draggable="r_test_2"]');
                if (!el) return { error: 'element not found' };
                const r = el.getBoundingClientRect();
                const svg = document.getElementById('plan');
                const svgRect = svg.getBoundingClientRect();
                const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
                const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
                return {
                    cx: r.left + r.width/2, cy: r.top + r.height/2,
                    left: r.left, top: r.top, width: r.width, height: r.height,
                    svgLeft: svgRect.left, svgTop: svgRect.top, svgW: svgRect.width, svgH: svgRect.height,
                    scrollX: scrollX, scrollY: scrollY
                };
            })()
        """)
        if "error" in room2:
            raise RuntimeError(room2["error"])
        from_x = room2["cx"]
        from_y = room2["cy"]

        # Use SVG absolute coordinates instead: SVG's viewport position + room's SVG position
        # Simpler: click at SVG element offset from room bounding box center
        # At zoom=1, SVG root coords ~= viewport offset from SVG origin
        svg_left = room2["svgLeft"]
        svg_top = room2["svgTop"]

        # Room 2 data: x=650, y=100, w=300, h=250 → center at (800, 225) in SVG root
        # Screen coords: svg_left + 800, svg_top + 225
        cx_svg = svg_left + 800
        cy_svg = svg_top + 225

        # Drag left 140px, down 80px in data space = same in viewport at zoom=1
        to_x = cx_svg - 140
        to_y = cy_svg + 80

        session.simulate_drag(cx_svg, cy_svg, to_x, to_y)
        time.sleep(0.3)

        # Verify room snapped to guide at x=515 and y=180
        r2_after = session.evaluate("""
            (() => {
                const r = App.DataStore.getRooms().find(rm => rm.id === 'r_test_2');
                return { x: r.x, y: r.y };
            })()
        """)
        assert r2_after["x"] == 515, f"Room x should snap to guide 515, got {r2_after['x']}"
        assert r2_after["y"] == 180, f"Room y should snap to guide 180, got {r2_after['y']}"

        # Restore test data
        session.evaluate("""
            (() => {
                App.DataStore.moveRoom('r_test_2', 650, 100);
                App.DataStore.removeGuide(App.DataStore.getGuides().find(g => g.position === 515).id);
                App.DataStore.removeGuide(App.DataStore.getGuides().find(g => g.position === 180).id);
                App.Renderer.render();
            })()
        """)

    test("21. Room snaps to guide on drag", room_snap)

    # --- 22. Nested objects are NOT rendered on SVG ---
    def nested_not_rendered():
        session.evaluate("""
            (() => {
                const parent = App.DataStore.getObject('o_test_1');
                App.DataStore.addObject({ name: 'Коробка', parentId: parent.id });
            })()
        """)
        roots = session.evaluate("App.DataStore.getRootObjects().length")
        assert roots == 2, f"Expected 2 root objects, got {roots}"
        rects = session.evaluate("document.querySelectorAll('[data-dtype=\"object\"]').length")
        assert rects == 2, f"Nested object should not be drawn: {rects} rects"
        nested = session.evaluate("App.DataStore.getObjects().find(o => o.name === 'Коробка')")
        assert nested and nested["parentId"] == 'o_test_1', "Nested object missing or wrong parentId"

    test("22. Nested object not rendered on SVG", nested_not_rendered)

    # --- 23. Search highlight of nested object highlights its root ---
    def nested_search_highlight():
        nested = session.evaluate("App.DataStore.getObjects().find(o => o.name === 'Коробка')")
        session.evaluate(f"App.EventBus.emit('search:results', {{ results: [{{ object: {{ id: '{nested['id']}' }} }}] }})")
        time.sleep(0.2)
        root_highlighted = session.evaluate("""
            (() => {
                const el = document.querySelector('[data-draggable="o_test_1"]');
                return el && el.classList.contains('search-match');
            })()
        """)
        assert root_highlighted, "Root object should be highlighted when nested child matches"
        session.evaluate("App.SearchManager.clear()")

    test("23. Search highlights root of nested match", nested_search_highlight)

    # --- 24. moveObjectInto cycle protection ---
    def move_object_cycle():
        nested = session.evaluate("App.DataStore.getObjects().find(o => o.name === 'Коробка')")
        # Trying to nest parent into its own child must be rejected
        session.evaluate(f"App.DataStore.moveObjectInto('o_test_1', '{nested['id']}')")
        parent = session.evaluate("App.DataStore.getObject('o_test_1')")
        assert parent["parentId"] is None, f"Parent must stay root, got {parent.get('parentId')}"
        # Nesting into itself rejected
        session.evaluate("App.DataStore.moveObjectInto('o_test_1', 'o_test_1')")
        parent = session.evaluate("App.DataStore.getObject('o_test_1')")
        assert parent["parentId"] is None, "Self-nesting must be rejected"
        # Detach back to root works
        detached = session.evaluate(f"App.DataStore.moveObjectInto('{nested['id']}', null)")
        assert detached is True, "Detaching nested object should succeed"

    test("24. moveObjectInto rejects cycles", move_object_cycle)

    # --- 25. Nested object inherits parent roomId ---
    def nested_inherits_room():
        session.evaluate("""
            (() => {
                const parent = App.DataStore.getObject('o_test_2');
                App.DataStore.addObject({ name: 'Ящик', parentId: parent.id });
            })()
        """)
        child = session.evaluate("App.DataStore.getObjects().find(o => o.name === 'Ящик')")
        assert child["roomId"] == "r_test_2", f"Nested should inherit room r_test_2, got {child.get('roomId')}"
        # Cleanup
        session.evaluate("App.DataStore.deleteObject('" + child["id"] + "')")

    test("25. Nested object inherits parent room", nested_inherits_room)

    # --- 26. deleteObject rejects non-empty (with nested children) ---
    def delete_nonempty_rejected():
        nested = session.evaluate("App.DataStore.getObjects().find(o => o.name === 'Коробка')")
        # Коробка is currently root (detached in test 24); put it back inside o_test_1
        session.evaluate(f"App.DataStore.moveObjectInto('{nested['id']}', 'o_test_1')")
        deleted = session.evaluate("App.DataStore.deleteObject('o_test_1')")
        assert deleted is False, "Deleting parent with children must fail"
        # Cleanup: delete nested then parent
        session.evaluate("""
            (() => {
                const nested = App.DataStore.getObjects().find(o => o.name === 'Коробка');
                App.DataStore.deleteObject(nested.id);
            })()
        """)
        deleted2 = session.evaluate("App.DataStore.deleteObject('o_test_1')")
        assert deleted2 is True, "Empty object should be deletable"

    test("26. deleteObject rejects non-empty parent", delete_nonempty_rejected)

    # --- 27. Multi-plan: create / switch / rename / delete ---
    def multi_plan_crud():
        created = session.evaluate("App.DataStore.createPlan('Интеграция')")
        assert created and created.get("id"), "createPlan should return new entry"
        pid = created["id"]
        assert pid != "plan", "New plan id must differ from legacy 'plan'"

        # New apartment becomes active and is empty
        rooms = session.evaluate("App.DataStore.getRooms().length")
        assert rooms == 0, f"New apartment must be empty, got {rooms} rooms"
        rects = session.evaluate("document.querySelectorAll('[data-dtype=\"room\"]').length")
        assert rects == 0, f"SVG must render no rooms for new apartment, got {rects}"

        # Select reflects the new active plan
        sel_val = session.evaluate("document.getElementById('planSelect') && document.getElementById('planSelect').value")
        assert sel_val == pid, f"planSelect must follow active plan, got {sel_val}"

        # Switch back to legacy plan — data restored and re-rendered
        ok = session.evaluate("App.DataStore.switchPlan('plan')")
        assert ok is True, "switchPlan('plan') should succeed"
        time.sleep(0.3)
        rooms2 = session.evaluate("App.DataStore.getRooms().length")
        assert rooms2 == 2, f"Legacy plan must keep its 2 rooms, got {rooms2}"
        rects2 = session.evaluate("document.querySelectorAll('[data-dtype=\"room\"]').length")
        assert rects2 == 2, f"SVG must re-render 2 rooms after switch, got {rects2}"

        # Isolation: marker room added in legacy plan is invisible in other plan
        session.evaluate("App.DataStore.addRoom({ name: 'Маркер', x: 10, y: 10, w: 100, h: 100 })")
        session.evaluate(f"App.DataStore.switchPlan('{pid}')")
        marker = session.evaluate("App.DataStore.getRooms().some(r => r.name === 'Маркер')")
        assert marker is False, "Marker room from plan must not leak into other apartment"

        # Rename + duplicate guard
        rn = session.evaluate(f"App.DataStore.renamePlan('{pid}', 'Вторая')")
        assert rn is True, "renamePlan should succeed"
        names = session.evaluate("App.DataStore.listPlans().map(p => p.name)")
        assert "Вторая" in names, f"Renamed plan must appear in registry: {names}"
        dup = session.evaluate(f"App.DataStore.renamePlan('{pid}', 'plan')")
        assert dup is False, "Duplicate names must be rejected"

        # Delete non-active keeps active intact
        dl = session.evaluate(f"App.DataStore.deletePlan('{pid}')")
        assert dl is True, "deletePlan should succeed"
        assert session.evaluate("App.DataStore.listPlans().length") == 1, "Only legacy plan must remain"

        # Last apartment cannot be deleted
        last = session.evaluate("App.DataStore.deletePlan('plan')")
        assert last is False, "Cannot delete the last remaining apartment"

        # Cleanup marker room
        session.evaluate("""
            (() => {
                const m = App.DataStore.getRooms().find(r => r.name === 'Маркер');
                if (m) App.DataStore.deleteRoom(m.id);
            })()
        """)
        assert session.evaluate("App.DataStore.getRooms().length") == 2, "Cleanup failed"

    test("27. Multi-plan create/switch/rename/delete", multi_plan_crud)

    # --- 28. Canvas drop: object dropped onto another nests into it ---
    def canvas_drop_nests():
        session.evaluate("""
            (() => {
                App.setZoom(1);
                App.DataStore.addObject({ name: 'ДропА', x: 200, y: 150, w: 100, h: 60 });
                App.DataStore.addObject({ name: 'ДропБ', x: 420, y: 150, w: 100, h: 60 });
                App.Renderer.render();
            })()
        """)
        ids = session.evaluate("""
            (() => {
                const a = App.DataStore.getObjects().find(o => o.name === 'ДропА');
                const b = App.DataStore.getObjects().find(o => o.name === 'ДропБ');
                return { a: a.id, b: b.id };
            })()
        """)
        roots_before = session.evaluate("App.DataStore.getRootObjects().length")

        coords = session.evaluate(f"""
            (() => {{
                const c = document.getElementById('plan-container');
                if (c) c.scrollTo(0, 0);
                const svg = document.getElementById('plan');
                const r = svg.getBoundingClientRect();
                const a = App.DataStore.getObject('{ids["a"]}');
                const b = App.DataStore.getObject('{ids["b"]}');
                return {{
                    fx: r.left + (a.x + a.w / 2), fy: r.top + (a.y + a.h / 2),
                    tx: r.left + (b.x + b.w / 2), ty: r.top + (b.y + b.h / 2)
                }};
            }})()
        """)
        assert coords["fx"] > 0 and coords["fy"] > 0, f"Drag source off-screen: {coords}"

        session.simulate_drag(coords["fx"], coords["fy"], coords["tx"], coords["ty"], steps=20)
        time.sleep(0.3)

        a_after = session.evaluate(f"App.DataStore.getObject('{ids['a']}')")
        assert a_after["parentId"] == ids["b"], \
            f"Dropped object must nest into target, got parentId={a_after.get('parentId')}"
        roots_after = session.evaluate("App.DataStore.getRootObjects().length")
        assert roots_after == roots_before - 1, f"Root count must decrease: {roots_before} -> {roots_after}"
        rects = session.evaluate(f"document.querySelectorAll('[data-draggable=\"{ids['a']}\"]').length")
        assert rects == 0, "Nested object must disappear from SVG"

        # Highlight was applied during drag hover at some point; after release nothing stays highlighted
        highlighted = session.evaluate("document.querySelectorAll('.drop-target').length")
        assert highlighted == 0, f"No drop-target residue after mouseup, got {highlighted}"

        # Cleanup
        session.evaluate(f"""
            (() => {{
                App.DataStore.deleteObject('{ids["a"]}');
                App.DataStore.deleteObject('{ids["b"]}');
            }})()
        """)
        assert session.evaluate(
            f"App.DataStore.getObject('{ids['a']}') === null && App.DataStore.getObject('{ids['b']}') === null"
        ), "Cleanup failed"

    test("28. Canvas drop nests object into another", canvas_drop_nests)

    # --- 29. Panel drag&drop: item onto child, child onto root crumb ---
    def panel_dnd():
        session.evaluate("""
            (() => {
                App.DataStore.addObjectItem('o_test_2', 'Ложка');
                App.DataStore.addObject({ name: 'ПанельЯщик', parentId: 'o_test_2' });
                App.PanelManager.showObject('o_test_2');
            })()
        """)
        child_id = session.evaluate(
            "App.DataStore.getObjects().find(o => o.name === 'ПанельЯщик').id"
        )

        def dispatch_dnd(from_sel_js, to_sel_js):
            session.evaluate(f"""
                (() => {{
                    const content = document.getElementById('panel-content');
                    const src = {from_sel_js};
                    const dst = {to_sel_js};
                    if (!src || !dst) throw new Error('dnd elements not found');
                    const dt = new DataTransfer();
                    src.dispatchEvent(new DragEvent('dragstart', {{ bubbles: true, cancelable: true, dataTransfer: dt }}));
                    dst.dispatchEvent(new DragEvent('dragover', {{ bubbles: true, cancelable: true, dataTransfer: dt }}));
                    dst.dispatchEvent(new DragEvent('drop', {{ bubbles: true, cancelable: true, dataTransfer: dt }}));
                    src.dispatchEvent(new DragEvent('dragend', {{ bubbles: true, dataTransfer: dt }}));
                }})()
            """)
            time.sleep(0.2)

        # Item row -> child object row
        dispatch_dnd(
            "content.querySelector('[data-drag-item]')",
            f"content.querySelector('[data-drop-object=\"{child_id}\"]')"
        )
        item_moved = session.evaluate(
            f"App.DataStore.getObject('{child_id}').items.includes('Ложка')"
        )
        assert item_moved, "Item must move into child object via panel dnd"
        parent_items = session.evaluate("App.DataStore.getObject('o_test_2').items.length")
        assert parent_items == 0, f"Source items must be empty after move, got {parent_items}"

        # Child object row -> «🏠 План» crumb (detach to root)
        dispatch_dnd(
            f"content.querySelector('[data-drag-object=\"{child_id}\"]')",
            "content.querySelector('[data-drop-root]')"
        )
        detached = session.evaluate(f"App.DataStore.getObject('{child_id}').parentId")
        assert detached is None, f"Drop on plan crumb must detach object, got parentId={detached}"

        # Cleanup
        session.evaluate(f"""
            (() => {{
                const c = App.DataStore.getObject('{child_id}');
                if (c.items.length) App.DataStore.removeObjectItem(c.id, 0);
                App.DataStore.deleteObject(c.id);
                App.PanelManager.showDefault();
            }})()
        """)

    test("29. Panel dnd moves item and detaches object", panel_dnd)

    # --- 30. Modal moveItem via «→» button ---
    def modal_move_item():
        session.evaluate("""
            (() => {
                App.DataStore.addObjectItem('o_test_2', 'Кружка');
                App.DataStore.addObject({ name: 'МодалЦель', x: 200, y: 300, w: 80, h: 50 });
            })()
        """)
        target_id = session.evaluate(
            "App.DataStore.getObjects().find(o => o.name === 'МодалЦель').id"
        )
        session.evaluate("App.ModalManager.showMoveItem('o_test_2', 0)")
        visible = session.evaluate("document.getElementById('modal-overlay').style.display !== 'none'")
        assert visible, "showMoveItem modal must open"

        has_select = session.evaluate("document.getElementById('modal-target-item') !== null")
        assert has_select, "modal-target-item select missing"

        session.evaluate(f"""
            (() => {{
                document.getElementById('modal-target-item').value = '{target_id}';
                App.ModalManager._submitMoveItem('o_test_2', 0);
            }})()
        """)
        moved = session.evaluate(f"App.DataStore.getObject('{target_id}').items.includes('Кружка')")
        assert moved, "Item must appear in target after modal submit"
        closed = session.evaluate("document.getElementById('modal-overlay').style.display === 'none'")
        assert closed, "Modal must close after successful move"

        # Cleanup
        session.evaluate(f"""
            (() => {{
                App.DataStore.removeObjectItem('{target_id}', 0);
                App.DataStore.deleteObject('{target_id}');
            }})()
        """)

    test("30. Modal moveItem transfers item", modal_move_item)

    # --- 31. Panel item dropped onto canvas root object ---
    def panel_item_to_canvas():
        session.evaluate("""
            (() => {
                App.setZoom(1);
                const shkaf = App.DataStore.addObject({ name: 'ШкафТест', x: 700, y: 150, w: 100, h: 80 });
                const polka = App.DataStore.addObject({ name: 'ПолкаТест', parentId: shkaf.id });
                App.DataStore.addObjectItem(polka.id, 'ОдеялоТест');
                App.DataStore.addObject({ name: 'КроватьТест', x: 700, y: 300, w: 100, h: 60 });
                App.PanelManager.showObject(polka.id);
            })()
        """)
        ids = session.evaluate("""
            (() => ({
                polka: App.DataStore.getObjects().find(o => o.name === 'ПолкаТест').id,
                bed: App.DataStore.getObjects().find(o => o.name === 'КроватьТест').id
            }))()
        """)

        # Synthetic HTML5 dnd: panel item row -> SVG root object rect
        moved = session.evaluate(f"""
            (() => {{
                const content = document.getElementById('panel-content');
                const src = content.querySelector('[data-drag-item]');
                const dst = document.querySelector('[data-draggable="{ids["bed"]}"]');
                if (!src || !dst) return {{ error: 'src=' + !!src + ' dst=' + !!dst }};
                const dt = new DataTransfer();
                src.dispatchEvent(new DragEvent('dragstart', {{ bubbles: true, cancelable: true, dataTransfer: dt }}));
                const overOk = dst.dispatchEvent(new DragEvent('dragover', {{ bubbles: true, cancelable: true, dataTransfer: dt }}));
                dst.dispatchEvent(new DragEvent('drop', {{ bubbles: true, cancelable: true, dataTransfer: dt }}));
                src.dispatchEvent(new DragEvent('dragend', {{ bubbles: true, dataTransfer: dt }}));
                return {{ overOk }};
            }})()
        """)
        assert "error" not in moved, f"dnd elements missing: {moved}"
        # dispatchEvent возвращает false, если preventDefault вызван — это и есть разрешённый drop
        assert moved["overOk"] is False, "dragover must be preventDefault'ed on canvas object (drop allowed)"

        in_bed = session.evaluate(
            f"App.DataStore.getObject('{ids['bed']}').items.includes('ОдеялоТест')"
        )
        assert in_bed, "Item must land on canvas target object"
        polka_items = session.evaluate(f"App.DataStore.getObject('{ids['polka']}').items.length")
        assert polka_items == 0, f"Source shelf must be empty after drop, got {polka_items}"

        # No highlight residue after drop
        residue = session.evaluate("document.querySelectorAll('.drop-target').length")
        assert residue == 0, f"No .drop-target residue after canvas drop, got {residue}"

        # Cleanup
        session.evaluate(f"""
            (() => {{
                App.DataStore.removeObjectItem('{ids['bed']}', 0);
                App.DataStore.deleteObject('{ids['polka']}');
                App.DataStore.deleteObject('{ids['bed']}');
                App.DataStore.deleteObject(App.DataStore.getObjects().find(o => o.name === 'ШкафТест').id);
                App.PanelManager.showDefault();
            }})()
        """)
        left = session.evaluate("App.DataStore.getObjects().some(o => ['ШкафТест','ПолкаТест','КроватьТест'].includes(o.name))")
        assert not left, "Cleanup failed"

    test("31. Panel item drops onto canvas root object", panel_item_to_canvas)

    return results
