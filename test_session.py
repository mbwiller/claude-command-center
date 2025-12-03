#!/usr/bin/env python3
"""
Test Session Script for Claude Code Command Center

Sends mock events to the server to test the dashboard display.
Run this to see how different event types appear in the UI.

Usage:
    python test_session.py              # Send a full test session
    python test_session.py --clear      # Clear all events first, then send test session
    python test_session.py --clear-only # Just clear all events
"""

import json
import urllib.request
import urllib.error
import time
import uuid
import argparse
from datetime import datetime

SERVER_URL = "http://localhost:4000"
EVENTS_ENDPOINT = f"{SERVER_URL}/events"
CLEAR_ENDPOINT = f"{SERVER_URL}/events/clear"


def send_event(event_data):
    """Send event to server."""
    try:
        data = json.dumps(event_data).encode("utf-8")
        req = urllib.request.Request(
            EVENTS_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode())
            print(f"  -> Event sent (id: {result.get('id')})")
            return True
    except urllib.error.URLError as e:
        print(f"  -> ERROR: Could not connect to server: {e}")
        return False
    except Exception as e:
        print(f"  -> ERROR: {e}")
        return False


def clear_events():
    """Clear all events from the server."""
    try:
        req = urllib.request.Request(
            CLEAR_ENDPOINT,
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            print("All events cleared!")
            return True
    except Exception as e:
        print(f"ERROR clearing events: {e}")
        return False


def run_test_session():
    """Run a complete test session with various event types."""
    session_id = f"test-session-{uuid.uuid4().hex[:8]}"
    cwd = "C:\\Users\\Matt Willer\\claude-code-command-center"

    print(f"\n{'='*60}")
    print(f"Running Test Session: {session_id}")
    print(f"{'='*60}\n")

    # 1. Session Start
    print("1. Sending SessionStart...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "SessionStart",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 2. User Input
    print("2. Sending UserPromptSubmit...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "UserPromptSubmit",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 3. Pre-Tool: Read file
    print("3. Sending PreToolUse (Read)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PreToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Read",
            "file_paths": [f"{cwd}\\dashboard\\src\\App.jsx"],
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 4. Post-Tool: Read file success
    print("4. Sending PostToolUse (Read - success)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PostToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Read",
            "file_paths": [f"{cwd}\\dashboard\\src\\App.jsx"],
            "tool_output": "1: import { useState, useEffect } from 'react';\n2: import { Activity, Zap } from 'lucide-react';\n3: // ... file contents truncated ...",
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 5. Pre-Tool: Bash command
    print("5. Sending PreToolUse (Bash)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PreToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Bash",
            "command": "npm run build",
            "description": "Build the dashboard",
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 6. Post-Tool: Bash with errors
    print("6. Sending PostToolUse (Bash - with errors)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PostToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Bash",
            "command": "npm run build",
            "description": "Build the dashboard",
            "tool_output": "Building...\nERROR: Module not found: 'react-icons'\nCompilation failed with 1 error.",
            "errors": ["ERROR: Module not found: 'react-icons'", "Compilation failed with 1 error."],
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 7. Pre-Tool: Spawning an agent
    print("7. Sending PreToolUse (Task - spawning researcher)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PreToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Task",
            "agent_type": "researcher",
            "agent_prompt": "Investigate the react-icons module error and find out how to properly import icons in this project.",
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.5)

    # 8. SubagentStop: Agent completed
    print("8. Sending SubagentStop (researcher done)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "SubagentStop",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "agent_type": "researcher",
            "agent_prompt": "Investigate the react-icons module error and find out how to properly import icons in this project.",
            "files_touched": [
                f"{cwd}\\dashboard\\package.json",
                f"{cwd}\\dashboard\\src\\App.jsx"
            ],
            "result_summary": "Found the issue: The project uses lucide-react instead of react-icons. The import statement should be 'import { Activity } from \"lucide-react\"' not 'import { Activity } from \"react-icons\"'.",
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 9. Pre-Tool: Edit file
    print("9. Sending PreToolUse (Edit)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PreToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Edit",
            "file_paths": [f"{cwd}\\dashboard\\src\\App.jsx"],
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 10. Post-Tool: Edit success
    print("10. Sending PostToolUse (Edit - success)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PostToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Edit",
            "file_paths": [f"{cwd}\\dashboard\\src\\App.jsx"],
            "tool_output": "File edited successfully",
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 11. Post-Tool: Bash success
    print("11. Sending PostToolUse (Bash - success)...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "PostToolUse",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "tool_name": "Bash",
            "command": "npm run build",
            "description": "Build the dashboard",
            "tool_output": "Building...\nDone in 2.3s\nBuild successful!",
            "cwd": cwd,
            "session_id": session_id,
        }
    })
    time.sleep(0.3)

    # 12. Stop (Response complete)
    print("12. Sending Stop...")
    send_event({
        "source_app": cwd,
        "session_id": session_id,
        "hook_event_type": "Stop",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            "cwd": cwd,
            "session_id": session_id,
        }
    })

    print(f"\n{'='*60}")
    print(f"Test session complete! Check your dashboard at http://localhost:5173")
    print(f"Session ID: {session_id}")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Test session for Command Center dashboard")
    parser.add_argument("--clear", action="store_true", help="Clear all events before sending test session")
    parser.add_argument("--clear-only", action="store_true", help="Only clear events, don't send test session")
    args = parser.parse_args()

    if args.clear_only:
        clear_events()
        return

    if args.clear:
        print("Clearing existing events...")
        clear_events()
        time.sleep(0.5)

    run_test_session()


if __name__ == "__main__":
    main()
