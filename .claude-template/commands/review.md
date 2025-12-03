# Review Command

Conduct thorough code review using the @reviewer agent.

## Usage
```
/review [scope - file, feature, or "recent"]
```

## Process
1. Spawn @reviewer agent
2. Gather context from TodoRead
3. Analyze code across dimensions:
   - Correctness
   - Security (critical for HackLearn Pro)
   - Performance
   - Maintainability
   - Test coverage
4. Run automated checks:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm test -- --coverage`
   - `npm audit`
5. Generate structured review report
6. Update TodoWrite with findings
7. Notify @memory-keeper of patterns found

## Arguments
$ARGUMENTS - Scope of review (file path, feature name, or "recent" for recent changes)

## Example
```
/review src/components/ModulePlayer.tsx
/review authentication-feature
/review recent
```

## Severity Levels
- 🔴 BLOCKER - Security/crash risks
- 🟠 CRITICAL - Logic errors
- 🟡 MAJOR - Performance/maintainability
- 🟢 MINOR - Style/docs

---

Begin code review of: $ARGUMENTS

Use @reviewer agent protocol. Pay special attention to security for HackLearn Pro.
