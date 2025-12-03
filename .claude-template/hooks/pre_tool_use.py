#!/usr/bin/env python3
"""
Pre-Tool Use Hook
Validates tool usage before execution and logs for observability.
"""

import json
import sys
import os
import re

# Dangerous patterns to block
BLOCKED_PATTERNS = [
    r"rm\s+-rf\s+/",           # Dangerous rm commands
    r"rm\s+-rf\s+~",           # Home directory deletion
    r">\s*/dev/sd",            # Direct disk writes
    r"mkfs\.",                 # Filesystem formatting
    r"dd\s+if=.*of=/dev",      # Direct device writes
]

# Sensitive file patterns
SENSITIVE_FILES = [
    r"\.env$",
    r"\.env\.\w+$",
    r"private.*key",
    r"credentials",
    r"secrets?\.(json|yaml|yml)$",
    r"\.pem$",
    r"\.key$",
]

def read_stdin():
    """Read hook payload from stdin."""
    try:
        if not sys.stdin.isatty():
            return json.load(sys.stdin)
    except json.JSONDecodeError:
        pass
    return {}

def is_blocked_command(command):
    """Check if command matches any blocked pattern."""
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return True, pattern
    return False, None

def is_sensitive_file(filepath):
    """Check if file path matches sensitive patterns."""
    for pattern in SENSITIVE_FILES:
        if re.search(pattern, filepath, re.IGNORECASE):
            return True
    return False

def validate_tool_use(payload):
    """Validate tool usage and return (allowed, reason)."""
    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {})
    
    # Bash command validation
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        blocked, pattern = is_blocked_command(command)
        if blocked:
            return False, f"Blocked dangerous command pattern: {pattern}"
    
    # File access validation
    if tool_name in ["Read", "Write", "Edit"]:
        filepath = tool_input.get("path", "") or tool_input.get("file_path", "")
        if is_sensitive_file(filepath):
            # Allow read but warn, block write
            if tool_name in ["Write", "Edit"]:
                return False, f"Blocked write to sensitive file: {filepath}"
    
    return True, None

def main():
    payload = read_stdin()
    
    allowed, reason = validate_tool_use(payload)
    
    if not allowed:
        # Return error to block the tool use
        result = {
            "status": "error",
            "message": reason
        }
        print(json.dumps(result))
        sys.exit(1)
    
    # Tool use is allowed
    sys.exit(0)

if __name__ == "__main__":
    main()
