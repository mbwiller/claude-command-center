#!/usr/bin/env python3
"""
Send Event Hook for Claude Code Observability v2.0
Sends events to the Command Center dashboard via HTTP POST.

Enhanced with protocol event support for:
- Quality gate validation results
- Agent handoff tracking
- Confidence score emission
- Phase transition events
"""

import json
import sys
import os
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from typing import Optional, Dict, Any

# Configuration
SERVER_URL = os.environ.get("OBSERVABILITY_SERVER", "http://localhost:4000")
EVENTS_ENDPOINT = f"{SERVER_URL}/events"

# Protocol event types
PROTOCOL_EVENT_TYPES = {
    "ProtocolEvent",    # Agent phase transitions with confidence
    "QualityGate",      # Gate validation results
    "AgentHandoff",     # Inter-agent coordination
    "MemoryOperation",  # Memory keeper operations
}


def get_working_directory():
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
    parser = argparse.ArgumentParser(description="Send Claude Code events to observability server")
    parser.add_argument("--source-app", required=False, default=None,
                        help="Source application identifier (defaults to working directory)")
    parser.add_argument("--event-type", required=True, help="Type of hook event")
    parser.add_argument("--summarize", action="store_true", help="Include AI summary of event")
    parser.add_argument("--add-chat", action="store_true", help="Include chat transcript")
    # New protocol-specific arguments
    parser.add_argument("--agent-type", help="Agent type for protocol events")
    parser.add_argument("--phase", help="Current workflow phase")
    parser.add_argument("--confidence", type=float, help="Confidence score (0.0-1.0)")
    parser.add_argument("--gate-name", help="Quality gate name for gate events")
    parser.add_argument("--gate-passed", type=bool, help="Whether gate passed")
    parser.add_argument("--gate-score", type=float, help="Gate score (0.0-1.0)")
    return parser.parse_args()

def get_session_id():
    """Extract session ID from environment or generate one."""
    return os.environ.get("CLAUDE_SESSION_ID", f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

def read_stdin():
    """Read JSON payload from stdin (provided by Claude Code hooks)."""
    try:
        if not sys.stdin.isatty():
            return json.load(sys.stdin)
    except json.JSONDecodeError:
        pass
    return {}

def estimate_tokens(payload):
    """Rough token estimation from payload content."""
    content = json.dumps(payload)
    # Rough estimate: ~4 chars per token
    return len(content) // 4

def estimate_cost(tokens, model="claude-sonnet-4"):
    """Estimate cost based on token count and model."""
    # Rough pricing (adjust based on actual pricing)
    rates = {
        "claude-opus-4": 0.00003,
        "claude-sonnet-4": 0.000006,
        "claude-haiku-4": 0.0000005,
    }
    rate = rates.get(model, rates["claude-sonnet-4"])
    return tokens * rate

def send_event(event_data):
    """Send event to observability server."""
    try:
        data = json.dumps(event_data).encode("utf-8")
        req = urllib.request.Request(
            EVENTS_ENDPOINT,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200 or response.status == 201
    except urllib.error.URLError as e:
        # Server not running - silently fail
        return False
    except Exception as e:
        return False

def build_protocol_payload(args, base_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Build enhanced payload for protocol events."""
    payload = {**base_payload}

    # Add protocol-specific fields if provided
    if args.agent_type:
        payload["agent_type"] = args.agent_type
    if args.phase:
        payload["phase"] = args.phase
    if args.confidence is not None:
        payload["confidence"] = args.confidence

    # Quality gate specific fields
    if args.gate_name:
        payload["gate_name"] = args.gate_name
    if args.gate_passed is not None:
        payload["passed"] = args.gate_passed
    if args.gate_score is not None:
        payload["score"] = args.gate_score

    return payload


def extract_protocol_info(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Extract protocol information from nested payload."""
    protocol_info = {}

    # Check for protocol markers in payload
    if "phase" in payload:
        protocol_info["phase"] = payload["phase"]
    if "confidence" in payload:
        protocol_info["confidence"] = payload["confidence"]
    if "gate_name" in payload:
        protocol_info["gate_name"] = payload["gate_name"]
    if "passed" in payload:
        protocol_info["passed"] = payload["passed"]
    if "score" in payload:
        protocol_info["score"] = payload["score"]

    # Check nested structures
    tool_input = payload.get("tool_input", {})
    if isinstance(tool_input, dict):
        if "subagent_type" in tool_input:
            protocol_info["agent_type"] = tool_input["subagent_type"]
        if "phase" in tool_input:
            protocol_info["phase"] = tool_input["phase"]

    return protocol_info


def main():
    args = parse_args()

    # Read hook payload from stdin
    payload = read_stdin()

    # Enhance payload with observability data
    tokens = estimate_tokens(payload)

    # Extract agent and protocol info
    agent_name = extract_agent_name(payload)
    protocol_info = extract_protocol_info(payload)

    # Determine source_app: use CLI arg if provided, otherwise detect working directory
    source_app = args.source_app if args.source_app else get_working_directory()

    # Build base event
    event = {
        "source_app": source_app,
        "session_id": get_session_id(),
        "hook_event_type": args.event_type,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": {
            **payload,
            "tokens_used": tokens,
            "cost_usd": f"{estimate_cost(tokens):.6f}",
            "duration_ms": payload.get("duration_ms", 0),
            "success": payload.get("success", True),
            "test_passed": payload.get("test_passed"),
            "tool_name": payload.get("tool_name"),
            "tool_input": payload.get("tool_input"),
            "agent_name": agent_name,
            **protocol_info,  # Include extracted protocol info
        }
    }

    # Add CLI-provided protocol info
    if args.agent_type or args.phase or args.confidence is not None:
        event["payload"] = build_protocol_payload(args, event["payload"])

    # For protocol event types, ensure required fields
    if args.event_type in PROTOCOL_EVENT_TYPES:
        event["payload"]["protocol_version"] = "2.0"

    # Send to server
    success = send_event(event)

    # Exit cleanly regardless of send status
    # (don't block Claude Code if server is down)
    sys.exit(0)

def extract_agent_name(payload):
    """Extract agent name from payload if this is a subagent event."""
    # Check for subagent markers in payload
    tool_input = payload.get("tool_input", {})
    if isinstance(tool_input, dict):
        # Check for @agent mentions in prompts
        prompt = tool_input.get("prompt", "") or tool_input.get("message", "")
        if isinstance(prompt, str):
            for agent in ["researcher", "implementer", "reviewer", "consensus", "memory-keeper"]:
                if f"@{agent}" in prompt.lower():
                    return agent
    
    # Check if this is a SubagentStop event
    if "subagent" in str(payload).lower():
        return payload.get("agent_name", "subagent")
    
    return None

if __name__ == "__main__":
    main()
