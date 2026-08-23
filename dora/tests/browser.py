"""
CDP browser launcher + WebSocket communication.
Launches Chrome/Brave with remote debugging, connects via CDP,
injects test data, evaluates JS, and captures results.
"""

import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

import websocket

CDP_PORT = 9222
BROWSER_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Program Files\BraveSoftware\Brave-Browser-Beta\Application\brave.exe",
]
PROFILE_DIR = os.path.join(os.path.dirname(__file__), "..", "temp", "profile")


def _find_browser():
    for p in BROWSER_PATHS:
        if os.path.isfile(p):
            return p
    raise RuntimeError("Browser not found. Set BROWSER_PATH in browser.py")


def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("localhost", port)) == 0


def get_cdp_targets():
    req = urllib.request.Request(f"http://localhost:{CDP_PORT}/json")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.load(resp)


def send_cdp(ws, method, params=None, msg_id=1, timeout=30):
    cmd = {"id": msg_id, "method": method, "params": params or {}}
    ws.settimeout(timeout)
    ws.send(json.dumps(cmd))
    while True:
        raw = ws.recv()
        response = json.loads(raw)
        if response.get("id") == msg_id:
            return response


class BrowserSession:
    """Manages a browser instance via CDP."""

    def __init__(self, browser_path=None, headless=False):
        self.browser_path = browser_path or _find_browser()
        self.headless = headless
        self.process = None
        self.ws_url = None
        self.ws = None

    def start(self):
        if not is_port_open(CDP_PORT):
            print(f"[browser] Launching {os.path.basename(self.browser_path)}...")
            os.makedirs(PROFILE_DIR, exist_ok=True)
            cmd = [
                self.browser_path,
                f"--remote-debugging-port={CDP_PORT}",
                f"--user-data-dir={PROFILE_DIR}",
                "--no-first-run",
                "--no-default-browser-check",
                "--remote-allow-origins=*",
            ]
            if self.headless:
                cmd.append("--headless=new")
            self.process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(30):
                time.sleep(0.5)
                if is_port_open(CDP_PORT):
                    break
            else:
                raise RuntimeError("Browser did not start in time")
            print("[browser] Ready")

    def connect_page(self, url):
        """Opens (or reuses) a tab at the given URL, returns the page WS URL."""
        # Get existing targets
        targets = get_cdp_targets()
        page_targets = [t for t in targets if t.get("type") == "page"]
        existing = next((t for t in page_targets if url in t.get("url", "")), None)

        if existing:
            ws_url = existing["webSocketDebuggerUrl"]
        elif page_targets:
            ws_url = page_targets[0]["webSocketDebuggerUrl"]
            self._navigate(ws_url, url)
        else:
            browser_target = next((t for t in targets if t.get("type") == "browser"), targets[0])
            ws = websocket.create_connection(browser_target["webSocketDebuggerUrl"], timeout=10)
            resp = send_cdp(ws, "Target.createTarget", {"url": "about:blank"})
            ws.close()
            target_id = resp["result"]["targetId"]
            targets = get_cdp_targets()
            ws_url = next(t["webSocketDebuggerUrl"] for t in targets if t["id"] == target_id)
            self._navigate(ws_url, url)

        self.ws_url = ws_url
        self.ws = websocket.create_connection(ws_url, timeout=30)

        # Wait for page load
        send_cdp(self.ws, "Page.enable")
        self._wait_load(10)
        return self.ws

    def _navigate(self, ws_url, url):
        ws = websocket.create_connection(ws_url, timeout=10)
        send_cdp(ws, "Page.navigate", {"url": url})
        ws.close()

    def _wait_load(self, timeout=10):
        started = time.time()
        while time.time() - started < timeout:
            self.ws.settimeout(0.5)
            try:
                raw = self.ws.recv()
                msg = json.loads(raw)
                if msg.get("method") == "Page.loadEventFired":
                    return
                if msg.get("method") == "Page.frameStoppedLoading":
                    return
            except websocket.WebSocketTimeoutException:
                break
        print("[browser] Page load event not received (continuing anyway)")

    def evaluate(self, js):
        """Evaluate JavaScript in page context, return the result."""
        resp = send_cdp(self.ws, "Runtime.evaluate", {
            "expression": js,
            "returnByValue": True,
            "awaitPromise": True,
        })
        if "exceptionDetails" in resp.get("result", {}):
            exc = resp["result"]["exceptionDetails"]
            text = exc.get("text", "") or exc.get("exception", {}).get("description", "")
            raise RuntimeError(f"JS error: {text}")
        return resp.get("result", {}).get("result", {}).get("value")

    def simulate_drag(self, from_x, from_y, to_x, to_y, steps=15):
        """Simulate mouse drag in viewport coordinates via CDP Input."""
        self.ws.settimeout(5)
        send_cdp(self.ws, "Input.dispatchMouseEvent", {
            "type": "mousePressed", "x": from_x, "y": from_y,
            "button": "left", "clickCount": 1,
        })
        for i in range(1, steps + 1):
            x = from_x + (to_x - from_x) * i / steps
            y = from_y + (to_y - from_y) * i / steps
            send_cdp(self.ws, "Input.dispatchMouseEvent", {
                "type": "mouseMoved", "x": x, "y": y,
                "button": "left",
            })
        send_cdp(self.ws, "Input.dispatchMouseEvent", {
            "type": "mouseReleased", "x": to_x, "y": to_y,
            "button": "left",
        })
        self.ws.settimeout(30)

    def inject_data(self, data_dict):
        """Inject test data into localStorage, then reload the page via CDP."""
        # Set viewport to 1920x1080 so rooms at x=650+ are visible
        send_cdp(self.ws, "Emulation.setDeviceMetricsOverride", {
            "width": 1920, "height": 1080,
            "deviceScaleFactor": 1, "mobile": False,
        })
        js = (
            f"localStorage.setItem('apartmentPlan', {json.dumps(json.dumps(data_dict))});"
            "localStorage.removeItem('apartmentPlans');"
            "localStorage.removeItem('apartmentPlanActive');"
        )
        try:
            self.evaluate(js)
        except Exception:
            pass
        # Reload via CDP
        send_cdp(self.ws, "Page.reload")
        self._wait_load(10)
        # Scroll plan container to show rooms on the right
        self.evaluate("""
            (() => {
                const c = document.getElementById('plan-container');
                if (c) c.scrollTo(600, 0);
            })()
        """)

    def screenshot(self, path="screenshot.png"):
        """Capture a screenshot of the current page."""
        resp = send_cdp(self.ws, "Page.captureScreenshot", {"format": "png"})
        data = resp["result"]["data"]
        import base64
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        print(f"[browser] Screenshot saved: {path}")

    def close(self):
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None
            print("[browser] Closed")

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *args):
        self.close()
