#!/usr/bin/env python3
"""
ImDora test runner.
Launches browser via CDP, runs unit tests (tests.html) and integration tests.

Usage:
    python tests/run_tests.py              # Run all tests
    python tests/run_tests.py --unit        # Run unit tests only
    python tests/run_tests.py --integration # Run integration tests only
    python tests/run_tests.py --headless    # Run all in headless mode
"""

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from browser import BrowserSession, is_port_open, CDP_PORT

UNIT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests.html"))
UNIT_URL = "file:///" + UNIT_PATH.replace("\\", "/")

INDEX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "index.html"))
INDEX_URL = "file:///" + INDEX_PATH.replace("\\", "/")

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def run_unit_tests(session):
    """Open tests.html and parse the inline test results."""
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}UNIT TESTS{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")
    print(f"  URL: {UNIT_URL}")

    session.connect_page(UNIT_URL)
    # Clear any leftover localStorage from previous runs
    session.evaluate("localStorage.clear()")
    session.evaluate("location.reload()")
    session._wait_load(10)
    time.sleep(1)

    # Wait for tests to finish
    time.sleep(1)

    # Read the summary text
    summary_text = session.evaluate("""
        (() => {
            const s = document.querySelector('.summary');
            return s ? s.textContent : null;
        })()
    """)

    # Collect individual test results
    results = session.evaluate("""
        (() => {
            const items = [];
            document.querySelectorAll('#output > div').forEach(div => {
                const text = div.textContent;
                if (text.startsWith('✓') || text.startsWith('✗')) {
                    items.push({
                        pass: text.startsWith('✓'),
                        text: text.substring(2)
                    });
                }
                if (text.startsWith('#')) {
                    items.push({ pass: null, text: text });
                }
            });
            return items;
        })()
    """)

    # Also collect any console errors
    console_errors = session.evaluate("""
        (() => {
            // Check if there are visible errors on page
            const fails = [];
            document.querySelectorAll('.fail').forEach(el => fails.push(el.textContent));
            return fails;
        })()
    """)

    passed = sum(1 for r in results if r and r.get("pass") is True)
    failed = sum(1 for r in results if r and r.get("pass") is False)
    total = passed + failed

    for r in results:
        if r is None:
            continue
        if r.get("pass") is True:
            print(f"  {GREEN}✓{RESET} {r['text']}")
        elif r.get("pass") is False:
            print(f"  {RED}✗{RESET} {r['text']}")

    if summary_text:
        print(f"\n  {BOLD}Summary:{RESET} {summary_text}")

    if failed > 0:
        print(f"\n  {RED}{failed} test(s) FAILED{RESET}")

    return {"passed": passed, "failed": failed, "total": total}


def run_integration_tests(session):
    """Run integration tests against index.html with injected test data."""
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}INTEGRATION TESTS{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")
    print(f"  URL: {INDEX_URL}")

    session.connect_page(INDEX_URL)
    import integration
    session.inject_data(integration.TEST_DATA)

    results = integration.run_all(session)

    passed = sum(1 for name, status, err in results if status == "PASS")
    failed = sum(1 for name, status, err in results if status == "FAIL")

    return {"passed": passed, "failed": failed, "total": len(results), "results": results}


def print_final_summary(all_results):
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📊 FINAL SUMMARY{RESET}")
    print(f"{'='*60}{RESET}")

    total_passed = 0
    total_failed = 0
    total_total = 0

    for suite_name, suite_results in all_results.items():
        p = suite_results.get("passed", 0)
        f = suite_results.get("failed", 0)
        t = suite_results.get("total", 0)
        total_passed += p
        total_failed += f
        total_total += t

        status_icon = "[OK]" if f == 0 else "[FAIL]"
        print(f"  {status_icon} {suite_name}: {p}/{t} passed", end="")
        if f > 0:
            print(f" ({f} failed)", end="")
        print()

    total_line = f"\n  {BOLD}Total: {total_passed}/{total_total} passed"
    if total_failed > 0:
        print(f"{total_line} ({total_failed} failed){RESET}")
        print(f"  {RED}SOME TESTS FAILED{RESET}")
    else:
        print(f"{total_line}{GREEN} ALL PASSED{RESET}")

    return total_failed == 0


def main():
    parser = argparse.ArgumentParser(description="ImDora Test Runner")
    parser.add_argument("--unit", action="store_true", help="Run unit tests only")
    parser.add_argument("--integration", action="store_true", help="Run integration tests only")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    parser.add_argument("--browser", default=None, help="Path to browser executable")
    args = parser.parse_args()

    run_unit = args.unit or not args.integration
    run_integration = args.integration or not args.unit

    all_results = {}

    with BrowserSession(browser_path=args.browser, headless=args.headless) as session:
        if run_unit:
            unit_results = run_unit_tests(session)
            all_results["Unit tests"] = unit_results

        if run_integration:
            integration_results = run_integration_tests(session)
            all_results["Integration tests"] = integration_results

    success = print_final_summary(all_results)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
