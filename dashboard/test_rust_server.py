#!/usr/bin/env python3
"""
Sprint 1.3 Integration Test: Python Hooks → Rust Server

This script tests that the Rust HTTP server (running in Tauri)
can receive events from the Python hooks.

Run this while the Tauri app is running:
    python test_rust_server.py

Expected output:
    - Health check should succeed
    - Event POST should return 201 Created
    - Events should appear in the Tauri dashboard
"""

import json
import sys
import urllib.request
import urllib.error
from datetime import datetime


def test_health(port: int = 4000) -> bool:
    """Test the health endpoint."""
    try:
        url = f"http://localhost:{port}/health"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print(f"✓ Health check passed (port {port})")
                return True
    except urllib.error.URLError as e:
        print(f"✗ Health check failed (port {port}): {e}")
    except Exception as e:
        print(f"✗ Health check error: {e}")
    return False


def find_server_port() -> int:
    """Find which port the Rust server is running on."""
    for port in [4000, 4001, 4002, 4003, 4004, 4005]:
        if test_health(port):
            return port
    return 0


def send_test_event(port: int, event_type: str, payload: dict = None) -> bool:
    """Send a test event to the server."""
    event = {
        "source_app": "sprint1-test",
        "session_id": f"test-session-{datetime.now().strftime('%H%M%S')}",
        "hook_event_type": event_type,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": payload or {}
    }

    try:
        url = f"http://localhost:{port}/events"
        data = json.dumps(event).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status in (200, 201):
                print(f"✓ Event '{event_type}' sent successfully (status {response.status})")
                return True
            else:
                print(f"✗ Event '{event_type}' failed with status {response.status}")
    except urllib.error.URLError as e:
        print(f"✗ Event '{event_type}' failed: {e}")
    except Exception as e:
        print(f"✗ Event '{event_type}' error: {e}")
    return False


def get_recent_events(port: int) -> list:
    """Fetch recent events from the server."""
    try:
        url = f"http://localhost:{port}/events/recent"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                events = json.loads(response.read().decode("utf-8"))
                print(f"✓ Fetched {len(events)} events from server")
                return events
    except urllib.error.URLError as e:
        print(f"✗ Fetch events failed: {e}")
    except Exception as e:
        print(f"✗ Fetch events error: {e}")
    return []


def run_integration_tests():
    """Run the full Sprint 1.3 integration test suite."""
    print("\n" + "=" * 60)
    print("Sprint 1.3 Integration Tests: Python Hooks → Rust Server")
    print("=" * 60 + "\n")

    # Find server
    print("[1/5] Finding Rust HTTP server...")
    port = find_server_port()
    if port == 0:
        print("\n✗ FAILED: Could not find Rust server on ports 4000-4005")
        print("  Make sure the Tauri app is running (npm run tauri:dev)")
        return False

    print(f"\n[2/5] Server found on port {port}")

    # Test sending different event types
    print("\n[3/5] Testing event types...")
    event_tests = [
        ("PostToolUse", {"tool_name": "Edit", "success": True, "tokens_used": 100}),
        ("PreToolUse", {"tool_name": "Bash"}),
        ("SubagentStop", {"agent_name": "researcher", "duration_ms": 5000}),
        ("ProtocolEvent", {"agent_type": "implementer", "phase": "implement", "confidence": 0.92}),
        ("QualityGate", {"gate_name": "test_coverage", "passed": True, "score": 0.87}),
    ]

    success_count = 0
    for event_type, payload in event_tests:
        if send_test_event(port, event_type, payload):
            success_count += 1

    print(f"\n  {success_count}/{len(event_tests)} event types sent successfully")

    # Verify events were stored
    print("\n[4/5] Verifying events were stored...")
    events = get_recent_events(port)
    test_events = [e for e in events if e.get("source_app") == "sprint1-test"]
    print(f"  Found {len(test_events)} test events in storage")

    # Summary
    print("\n[5/5] Test Summary")
    print("-" * 40)

    all_passed = port > 0 and success_count == len(event_tests) and len(test_events) > 0

    if all_passed:
        print("✓ All tests PASSED!")
        print("\nSprint 1.3 Integration Verified:")
        print("  • Rust HTTP server is running")
        print("  • Python can POST events to Rust server")
        print("  • Events are stored and retrievable")
        print("  • Ready for Human-In-The-Loop verification:")
        print("    → Check Tauri app shows 'sprint1-test' session")
        print("    → Verify events appear in real-time")
    else:
        print("✗ Some tests FAILED")
        if port == 0:
            print("  • Server not found - start Tauri app first")
        if success_count < len(event_tests):
            print(f"  • Only {success_count}/{len(event_tests)} events sent")
        if len(test_events) == 0:
            print("  • No test events found in storage")

    print("\n" + "=" * 60 + "\n")
    return all_passed


if __name__ == "__main__":
    success = run_integration_tests()
    sys.exit(0 if success else 1)
