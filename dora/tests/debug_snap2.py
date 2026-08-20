"""Step-by-step snap test — simulates real mouse movement pixel by pixel."""

import sys, os, time, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(__file__))
from browser import BrowserSession, send_cdp
import integration

INDEX_URL = "file:///" + os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "index.html")).replace("\\", "/")

with BrowserSession(headless=True) as s:
    s.connect_page(INDEX_URL)
    s.inject_data(integration.TEST_DATA)
    time.sleep(0.5)

    # Clear all guides (safe copy)
    s.evaluate("App.DataStore.getGuides().slice().forEach(g => App.DataStore.removeGuide(g.id))")
    s.evaluate("App.Renderer.render()")
    time.sleep(0.3)

    z = s.evaluate("App.getZoom()")
    print(f"Zoom = {z}")

    room = json.loads(s.evaluate("""JSON.stringify((() => {
        const el = document.querySelector('[data-draggable="r_test_2"]');
        const r = el.getBoundingClientRect();
        return { cx: r.left+r.width/2, cy: r.top+r.height/2, x: App.DataStore.getRooms().find(rm=>rm.id==='r_test_2').x };
    })())"""))
    print(f"Room: data x={room['x']}, vp center=({room['cx']:.0f},{room['cy']:.0f})\n")

    # Step-by-step: 1px per step, 60 steps left
    from_x, from_y = room['cx'], room['cy']
    to_x = from_x - 60

    # mousePressed
    send_cdp(s.ws, "Input.dispatchMouseEvent", {
        "type": "mousePressed", "x": from_x, "y": from_y,
        "button": "left", "clickCount": 1, "buttons": 1,
    })
    time.sleep(0.05)

    print(f"{'step':>5} {'screen_x':>7} {'data_newX':>8} {'room_x':>7}")
    print("-" * 35)

    prev_room_x = room['x']
    snap_engaged = False

    for i in range(1, 61):
        t = i / 60.0
        sx = from_x + (to_x - from_x) * t
        sy = from_y

        # Use CDP Input dispatch for real mouse events
        send_cdp(s.ws, "Input.dispatchMouseEvent", {
            "type": "mouseMoved", "x": sx, "y": sy,
            "button": "left", "buttons": 1,
        })
        time.sleep(0.01)

        cur_x = s.evaluate("App.DataStore.getRooms().find(r=>r.id==='r_test_2').x")
        new_x = room['x'] + (sx - from_x)  # expected newX if no snap
        snapped = cur_x != prev_room_x and cur_x != round(new_x)
        if snapped:
            snap_engaged = True

        # Print every step near snap zone
        if snapped or abs(new_x - 600) < 15 or i % 10 == 0:
            marker = " <<< SNAP" if snapped else ""
            print(f"{i:>5} {sx:>7.0f} {new_x:>+8.1f} {cur_x:>7}{marker}")

        prev_room_x = cur_x

    send_cdp(s.ws, "Input.dispatchMouseEvent", {
        "type": "mouseReleased", "x": to_x, "y": from_y,
        "button": "left", "buttons": 1,
    })
    time.sleep(0.2)

    final_x = s.evaluate("App.DataStore.getRooms().find(r=>r.id==='r_test_2').x")
    print(f"\nFinal room x = {final_x}")

    if snap_engaged:
        print(">>> SNAP ENGAGED during drag")
    if final_x == 600:
        print(">>> ROOM AT GRID 600 - snap works")
    else:
        print(f">>> NO SNAP (expected 600, got {final_x})")
