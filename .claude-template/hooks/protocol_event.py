#!/usr/bin/env python3
"""
Protocol Event Emitter for Claude Code Observability v2.0

This hook emits structured protocol events to the observability server.
Called by agents during phase transitions, quality gate validations,
and inter-agent handoffs.

Usage:
    # Emit a phase transition
    echo '{"phase": "synthesis", "confidence": 0.85}' | python protocol_event.py --agent researcher --event-type progress

    # Emit a quality gate result
    echo '{"gate_name": "input_clarity", "passed": true, "score": 0.88}' | python protocol_event.py --agent researcher --event-type gate

    # Emit a handoff
    echo '{"to_agent": "implementer", "context": {...}}' | python protocol_event.py --agent researcher --event-type handoff
"""

import sys
import json
import os
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
SERVER_URL = os.environ.get("OBSERVABILITY_SERVER", "http://localhost:4000")
EVENTS_ENDPOINT = f"{SERVER_URL}/events"
QUALITY_GATE_THRESHOLD = 0.8


def get_working_directory() -> str:
    """
    Get the current working directory in a cross-platform manner.
    Uses environment variables first (Claude Code may set these),
    then falls back to os.getcwd().

    Returns the full path on all platforms.
    """
    # Check for Claude Code environment variables first
    cwd = os.environ.get("CLAUDE_CWD")
    if cwd:
        return cwd

    # Check PWD (Unix) then CD (Windows batch)
    cwd = os.environ.get("PWD") or os.environ.get("CD")
    if cwd:
        return cwd

    # Fall back to os.getcwd() - works on both Windows and Unix
    try:
        return os.getcwd()
    except OSError:
        return "unknown"


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Emit protocol events to observability server")
    parser.add_argument("--agent", required=True,
                        choices=["researcher", "implementer", "reviewer", "consensus", "memory-keeper"],
                        help="Agent type emitting the event")
    parser.add_argument("--event-type", required=True,
                        choices=["spawn", "progress", "gate", "complete", "handoff", "error"],
                        help="Type of protocol event")
    parser.add_argument("--session-id", help="Session ID (defaults to env or generated)")
    return parser.parse_args()


def get_session_id(override: Optional[str] = None) -> str:
    """Get session ID from override, environment, or generate one."""
    if override:
        return override
    return os.environ.get("CLAUDE_SESSION_ID",
                          f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}")


def read_stdin() -> Dict[str, Any]:
    """Read JSON payload from stdin."""
    try:
        if not sys.stdin.isatty():
            return json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Warning: Invalid JSON input: {e}", file=sys.stderr)
    return {}


def send_event(event: Dict[str, Any]) -> bool:
    """Send event to observability server."""
    try:
        data = json.dumps(event).encode("utf-8")
        req = urllib.request.Request(
            EVENTS_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status in (200, 201)
    except urllib.error.URLError:
        return False  # Server not running - silent failure
    except Exception:
        return False


def build_spawn_event(agent: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build a spawn event payload."""
    return {
        "event_type": "spawn",
        "agent_type": agent,
        "protocol_version": "2.0",
        "phase": "initialization",
        "confidence": 1.0,
        "context": {
            "task": payload.get("task", ""),
            "scope": payload.get("scope", {}),
            "requirements": payload.get("requirements", []),
        }
    }


def build_progress_event(agent: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build a progress event payload."""
    return {
        "event_type": "progress",
        "agent_type": agent,
        "protocol_version": "2.0",
        "phase": payload.get("phase", "execution"),
        "confidence": payload.get("confidence", 0.5),
        "context": {
            "completed_steps": payload.get("completed_steps", []),
            "remaining_steps": payload.get("remaining_steps", []),
            "current_activity": payload.get("current_activity", ""),
        }
    }


def build_gate_event(agent: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build a quality gate event payload."""
    score = payload.get("score", 0.0)
    passed = payload.get("passed", score >= QUALITY_GATE_THRESHOLD)

    return {
        "event_type": "gate",
        "agent_type": agent,
        "protocol_version": "2.0",
        "gate_name": payload.get("gate_name", "unknown"),
        "passed": passed,
        "score": score,
        "threshold": payload.get("threshold", QUALITY_GATE_THRESHOLD),
        "feedback": payload.get("feedback", ""),
        "context": payload.get("context", {})
    }


def build_complete_event(agent: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build a completion event payload."""
    return {
        "event_type": "complete",
        "agent_type": agent,
        "protocol_version": "2.0",
        "phase": "complete",
        "confidence": payload.get("confidence", 0.8),
        "context": {
            "output_summary": payload.get("output_summary", ""),
            "files_modified": payload.get("files_modified", []),
            "quality_metrics": payload.get("quality_metrics", {}),
            "duration_ms": payload.get("duration_ms", 0),
        }
    }


def build_handoff_event(agent: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build a handoff event payload."""
    return {
        "event_type": "handoff",
        "agent_type": agent,
        "protocol_version": "2.0",
        "from_agent": agent,
        "to_agent": payload.get("to_agent", "unknown"),
        "handoff_type": payload.get("handoff_type", "task_delegation"),
        "document": json.dumps(payload.get("document", {})),
        "metadata": json.dumps({
            "confidence": payload.get("confidence", 0.8),
            "priority": payload.get("priority", "medium"),
            "reason": payload.get("reason", ""),
        })
    }


def build_error_event(agent: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build an error event payload."""
    return {
        "event_type": "error",
        "agent_type": agent,
        "protocol_version": "2.0",
        "phase": payload.get("phase", "unknown"),
        "confidence": 0.0,
        "context": {
            "error_code": payload.get("error_code", "UNKNOWN"),
            "error_message": payload.get("error_message", "An error occurred"),
            "recoverable": payload.get("recoverable", False),
            "suggestions": payload.get("suggestions", []),
        }
    }


EVENT_BUILDERS = {
    "spawn": build_spawn_event,
    "progress": build_progress_event,
    "gate": build_gate_event,
    "complete": build_complete_event,
    "handoff": build_handoff_event,
    "error": build_error_event,
}


def main():
    args = parse_args()

    # Read payload from stdin
    payload = read_stdin()

    # Build event-specific payload
    builder = EVENT_BUILDERS.get(args.event_type)
    if not builder:
        print(f"Unknown event type: {args.event_type}", file=sys.stderr)
        sys.exit(1)

    event_payload = builder(args.agent, payload)

    # Determine hook event type for server routing
    hook_event_type_map = {
        "spawn": "ProtocolEvent",
        "progress": "ProtocolEvent",
        "gate": "QualityGate",
        "complete": "ProtocolEvent",
        "handoff": "AgentHandoff",
        "error": "ProtocolEvent",
    }

    # Build full event
    event = {
        "source_app": get_working_directory(),
        "session_id": get_session_id(args.session_id),
        "hook_event_type": hook_event_type_map.get(args.event_type, "ProtocolEvent"),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": event_payload
    }

    # Send to server
    success = send_event(event)

    if success:
        # Output the event for logging/debugging
        print(json.dumps({"status": "sent", "event_type": args.event_type}, indent=2))
    else:
        print(json.dumps({"status": "failed", "event_type": args.event_type}, indent=2))

    # Always exit cleanly (don't block Claude Code)
    sys.exit(0)


if __name__ == "__main__":
    main()
