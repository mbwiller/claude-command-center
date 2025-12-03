# Claude Code Command Center

> **Real-Time Observability Dashboard for Claude Code Sessions**

---

## ⚠️ CURRENT STATUS: Development Phase

**The dashboard currently displays TEST DATA from `test_session.py`.**

Integration with real Claude Code sessions requires hook installation (see below).

---

## What This Dashboard CAN and CANNOT Do

### ✅ CAN Display (Available from Claude Code Hooks)

| Data | Source | Description |
|------|--------|-------------|
| **Tool name** | `tool_name` | Read, Write, Edit, Bash, Grep, Glob, Task, etc. |
| **Tool input** | `tool_input` | File paths, commands, glob patterns, prompts |
| **Tool output** | `tool_output` | File contents, command output, search results |
| **Working directory** | `cwd` | Project path where Claude Code is running |
| **Session ID** | `session_id` | Unique identifier for each session |
| **Event type** | Hook type | PreToolUse, PostToolUse, SubagentStop, Stop, etc. |
| **Timestamp** | Generated | When the event occurred |
| **Agent type** | `subagent_type` | Which subagent was spawned (researcher, implementer, etc.) |
| **Files accessed** | Extracted | File paths from Read/Edit/Write operations |
| **Commands run** | Extracted | Bash commands executed |
| **Errors** | Parsed | Error messages detected in tool output |

### ❌ CANNOT Display (Not Available in Hooks)

| Data | Why Not Available | Workaround |
|------|-------------------|------------|
| **Token count** | Not exposed in Claude Code hooks | None - would need API access |
| **Context window usage** | Internal to Claude Code | None |
| **Cost/pricing** | Not exposed | None - MAX plan is unlimited anyway |
| **Model name** | Not reliably exposed | None |
| **Input/output token breakdown** | Not in hooks | None |
| **Rate limit status** | Not exposed | None |
| **Full conversation** | Only partial via `--add-chat` | Limited |

### ⚠️ Can Estimate/Infer

| Data | Method |
|------|--------|
| **Duration** | Calculate from timestamps between events |
| **Error detection** | Parse tool_output for "error", "failed", etc. |
| **File modification patterns** | Track which files are touched frequently |

---

## Context Window Visualization: The Reality

**You CANNOT build a context window meter with Claude Code hooks.**

Claude Code hooks do not expose token counts. The hooks only fire when tools are used - they don't have access to the underlying API response metadata.

**To get token/cost data, you would need:**
1. Direct Anthropic API access (not through Claude Code)
2. A proxy that intercepts API calls
3. Anthropic to add token exposure to Claude Code hooks (feature request)

**What you CAN visualize:**
- Tool usage patterns over time
- Which files are read/edited most
- Agent spawn patterns
- Error frequency
- Session duration and activity timeline

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMAND CENTER ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────────┐│
│  │ CLAUDE CODE │──▶│   HOOKS      │──▶│   OBSERVABILITY       ││
│  │ CLI SESSION │   │ (Python)     │   │   SERVER (Bun)        ││
│  └─────────────┘   └──────────────┘   └───────────────────────┘│
│         │                │                       │              │
│         ▼                ▼                       ▼              │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────────┐│
│  │ .claude/    │   │ SQLite DB    │   │  REACT DASHBOARD      ││
│  │ - agents/   │   │ (events.db)  │   │  - Real-time updates  ││
│  │ - commands/ │   └──────────────┘   │  - WebSocket stream   ││
│  │ - hooks/    │                      │  - Filtering          ││
│  │ - memory/   │                      │  - Analytics          ││
│  └─────────────┘                      └───────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Claude Code CLI** with MAX plan
- **Bun** (for server) - https://bun.sh
- **Node.js** (for dashboard) - v18+
- **Python 3.8+** (for hooks)

### Start the Dashboard (Test Mode)

```bash
# Terminal 1: Start server
cd server
bun run index.ts

# Terminal 2: Start dashboard
cd dashboard
npm run dev

# Terminal 3: Send test events
cd ..
python test_session.py --clear
```

Open http://localhost:5173 to see test events.

### Test Session Script

The `test_session.py` script sends fake events to test the dashboard:

```bash
python test_session.py              # Send test events
python test_session.py --clear      # Clear DB first, then send events
python test_session.py --clear-only # Just clear the database
```

---

## 🔌 Integration with Real Claude Code Sessions

**STATUS: NOT YET INTEGRATED**

To connect real Claude Code sessions, you need to install hooks.

### Step 1: Copy Hook Configuration

```bash
# Windows
copy .claude-template\settings.json %USERPROFILE%\.claude\settings.json
mkdir %USERPROFILE%\.claude\hooks
copy .claude-template\hooks\*.py %USERPROFILE%\.claude\hooks\

# Mac/Linux
cp .claude-template/settings.json ~/.claude/settings.json
mkdir -p ~/.claude/hooks
cp .claude-template/hooks/*.py ~/.claude/hooks/
```

### Step 2: Verify Hooks Are Installed

Check that `~/.claude/settings.json` contains hook configuration and the hook files exist:
- `~/.claude/hooks/send_event.py`
- `~/.claude/hooks/pre_tool_use.py` (optional)
- `~/.claude/hooks/post_tool_use.py` (optional)

### Step 3: Start Server and Dashboard

```bash
# Terminal 1
cd server && bun run index.ts

# Terminal 2
cd dashboard && npm run dev
```

### Step 4: Start a Claude Code Session

Open a new terminal and start Claude Code in any project:

```bash
claude
```

Events should now appear in the dashboard in real-time.

## 📁 Directory Structure

```
claude-code-command-center/
├── dashboard/              # React dashboard
│   ├── src/
│   │   ├── App.jsx        # Main dashboard component
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # Styles
│   └── package.json
│
├── server/                 # Bun observability server
│   ├── index.ts           # Server with WebSocket support
│   └── package.json
│
├── .claude-template/       # Template for ~/.claude/
│   ├── CLAUDE.md          # Global instructions
│   ├── settings.json      # Hook configuration
│   ├── agents/            # Custom subagents
│   │   ├── researcher.md
│   │   ├── implementer.md
│   │   ├── reviewer.md
│   │   ├── consensus.md
│   │   └── memory-keeper.md
│   ├── commands/          # Custom slash commands
│   │   ├── research.md
│   │   ├── implement.md
│   │   ├── review.md
│   │   ├── decide.md
│   │   ├── memory.md
│   │   ├── test.md
│   │   └── hacklearn.md
│   ├── hooks/             # Observability hooks
│   │   ├── send_event.py
│   │   ├── pre_tool_use.py
│   │   └── post_tool_use.py
│   └── memory/            # Long-term memory files
│       ├── DECISIONS.md
│       ├── PATTERNS.md
│       └── MODULES_STATUS.md
│
├── setup.sh               # Installation script
├── start.sh               # Start Command Center
├── stop.sh                # Stop Command Center
└── README.md              # This file
```

## 🤖 Custom Agents

### @researcher
Deep exploration agent for gathering information and synthesizing insights.

```
/research what are the best practices for prompt injection defense?
```

### @implementer  
Systematic implementation agent for building features with quality gates.

```
/implement add progress bar component to module completion UI
```

### @reviewer
Code review agent focusing on correctness, security, and maintainability.

```
/review src/components/ModulePlayer.tsx
```

### @consensus
Multi-perspective decision agent for complex architectural choices.

```
/decide WebSocket vs SSE for LLM playground streaming
```

### @memory-keeper
Long-term project memory agent that maintains persistent context across sessions.

```
/memory save architectural Decided to use React Query for server state
/memory recall LLM playground decisions
/memory summarize week
```

## 📊 Dashboard Features

### What's Currently Displayed

| Feature | Status | Description |
|---------|--------|-------------|
| Event list | ✅ Working | Real-time stream of tool events |
| Session grouping | ✅ Working | Events grouped by session/project |
| Event filtering | ✅ Working | Filter by event type |
| Expandable details | ✅ Working | Click to see files, commands, errors |
| Dynamic labels | ✅ Working | Labels like "Read: App.jsx" instead of generic "Post-Tool" |
| Agent badges | ✅ Working | Shows @researcher, @implementer, etc. |
| Error highlighting | ✅ Working | Red badges for events with errors |
| Token/cost metrics | ❌ Not possible | Hooks don't expose this data |
| Context window meter | ❌ Not possible | Hooks don't expose this data |

### Event Types

| Event | Emoji | Description |
|-------|-------|-------------|
| PreToolUse | 🔧 | Before tool execution |
| PostToolUse | ✅ | After tool completion |
| SubagentStop | 👥 | Subagent finished |
| UserPromptSubmit | 💬 | User prompt submitted |
| Notification | 🔔 | User interaction |
| Stop | 🛑 | Response complete |
| SessionStart | 🚀 | Session began |
| SessionEnd | 🏁 | Session ended |

### Agent Color Coding

| Agent | Color |
|-------|-------|
| @researcher | Violet |
| @implementer | Emerald |
| @reviewer | Amber |
| @consensus | Cyan |
| @memory-keeper | Rose |

## 🔧 Configuration

### Environment Variables

Set these to customize behavior:

```bash
export OBSERVABILITY_SERVER="http://localhost:4000"  # Server URL
export CLAUDE_CODE_ENABLE_TELEMETRY="1"              # Enable native telemetry
```

### Customizing Hooks

Edit `~/.claude/settings.json` to modify hook behavior:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude/hooks/send_event.py --source-app your-app --event-type PreToolUse"
          }
        ]
      }
    ]
  }
}
```

### Project-Specific Configuration

Copy `.claude` folder to any project for project-specific settings:

```bash
cp -r ~/.claude /path/to/your/project/.claude
```

Then customize the `source-app` in `settings.json`.

## 🎓 HackLearn Pro Integration

Special commands for HackLearn Pro module development:

```bash
/hacklearn new sql-injection hacking      # Create new module
/hacklearn status all                      # Check all module status
/hacklearn interactive playground llm-basics  # Add interactive element
/hacklearn gamify badge prompt-engineering    # Add gamification
/hacklearn cot transformer-attention          # Generate CoT demo
```

## 🔒 Security

The hooks include security measures:

- **Blocked Commands**: Dangerous patterns like `rm -rf /` are blocked
- **Sensitive Files**: Writes to `.env`, credentials, and secrets are prevented
- **Validation**: All tool inputs are validated before execution

## 📈 Optimizing Your Sessions

Based on observability data, optimize by:

1. **Agent Distribution** - Use subagents more for parallel work
2. **Tool Efficiency** - Reduce redundant tool calls
3. **Test Coverage** - Maintain high test pass rates
4. **Memory Usage** - Leverage @memory-keeper for context
5. **Task Decomposition** - Break large tasks into atomic steps

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 4000 is in use
lsof -i :4000

# Kill existing process
kill -9 $(lsof -t -i:4000)
```

### Dashboard shows "Disconnected"
```bash
# Ensure server is running
curl http://localhost:4000/health
```

### Hooks not firing
```bash
# Check hook files are executable
chmod +x ~/.claude/hooks/*.py

# Verify Python is available
which python3
```

### Events not appearing
```bash
# Test event submission manually
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app":"test","session_id":"test-1","hook_event_type":"PreToolUse","payload":{}}'
```

## 🚀 Next Steps

1. **Start the Command Center**: `./start.sh`
2. **Open dashboard**: http://localhost:5173
3. **Start Claude Code** in any project
4. **Use agents**: Try `/research`, `/implement`, etc.
5. **Watch events** stream in real-time
6. **Review patterns** to optimize workflow

## 📝 License

MIT - Built with ❤️ for HackLearn Pro

---

*"Make Claude Code as well set-up and free to be amazing as possible!"* - Matt's Vision
