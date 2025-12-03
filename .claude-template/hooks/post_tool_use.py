#!/usr/bin/env python3
"""
Post-Tool Use Hook
Logs tool results for observability and tracks success/failure patterns.
"""

import json
import sys
import os
from datetime import datetime

def read_stdin():
    """Read hook payload from stdin."""
    try:
        if not sys.stdin.isatty():
            return json.load(sys.stdin)
    except json.JSONDecodeError:
        pass
    return {}

def determine_success(payload):
    """Determine if the tool use was successful."""
    tool_name = payload.get("tool_name", "")
    tool_output = payload.get("tool_output", "")
    
    # Check for common error patterns
    error_patterns = [
        "error:",
        "Error:",
        "ERROR:",
        "failed",
        "Failed",
        "FAILED",
        "exception",
        "Exception",
        "not found",
        "permission denied",
    ]
    
    output_str = str(tool_output).lower()
    for pattern in error_patterns:
        if pattern.lower() in output_str:
            return False
    
    return True

def detect_test_result(payload):
    """Detect if this was a test run and determine pass/fail."""
    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {})
    tool_output = payload.get("tool_output", "")
    
    # Check if this is a test command
    if tool_name != "Bash":
        return None
    
    command = tool_input.get("command", "")
    test_commands = ["npm test", "jest", "vitest", "pytest", "cargo test"]
    
    is_test = any(tc in command for tc in test_commands)
    if not is_test:
        return None
    
    output_str = str(tool_output)
    
    # Check for test results
    if "PASS" in output_str or "passed" in output_str.lower():
        if "FAIL" not in output_str and "failed" not in output_str.lower():
            return True
    
    if "FAIL" in output_str or "failed" in output_str.lower():
        return False
    
    return None

def main():
    payload = read_stdin()
    
    # Enhance payload with analysis
    success = determine_success(payload)
    test_passed = detect_test_result(payload)
    
    # Add metadata for observability
    enhanced = {
        **payload,
        "success": success,
        "test_passed": test_passed,
        "completed_at": datetime.utcnow().isoformat() + "Z",
    }
    
    # Output enhanced payload (will be piped to send_event.py if configured)
    print(json.dumps(enhanced))
    sys.exit(0)

if __name__ == "__main__":
    main()
