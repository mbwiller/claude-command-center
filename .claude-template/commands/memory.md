# Memory Command

Interact with long-term project memory using the @memory-keeper agent.

## Usage
```
/memory [action] [arguments]
```

## Actions

### save
Save a new memory entry.
```
/memory save [category] [content]
```
Categories: architectural, pattern, bug, metric, module, future

### recall  
Search memory for relevant context.
```
/memory recall [topic or question]
```

### summarize
Generate summary of recent learnings.
```
/memory summarize [timeframe: day|week|month]
```

### status
Show current memory health and stats.
```
/memory status
```

### audit
Review memory for consolidation opportunities.
```
/memory audit
```

## Arguments
$ARGUMENTS - Action and additional arguments

## Examples
```
/memory save architectural Decided to use SSE over WebSocket for streaming - simpler error handling
/memory recall LLM playground decisions
/memory summarize week
/memory status
```

## Memory Files
Located in `.claude/memory/`:
- DECISIONS.md - Architectural decisions
- PATTERNS.md - Learned patterns
- MODULES_STATUS.md - HackLearn Pro modules
- SESSION_INSIGHTS.md - Cross-session learnings
- TECH_DEBT.md - Technical debt
- METRICS_BASELINE.md - Reference benchmarks

---

Execute memory operation: $ARGUMENTS

Use @memory-keeper agent protocol. Maintain HackLearn Pro institutional knowledge.
