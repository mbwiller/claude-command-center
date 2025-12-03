# Implement Command

Systematically implement a feature using the @implementer agent.

## Usage
```
/implement [feature description]
```

## Process
1. Spawn @implementer agent
2. Review any @researcher findings in TodoRead
3. Break down into atomic tasks
4. Execute implementation:
   - Types/interfaces first
   - Core logic
   - Components/UI
   - Integration
   - Error handling
   - Tests
5. Run quality checklist
6. Update TodoWrite with status
7. Flag for @reviewer if significant

## Arguments
$ARGUMENTS - Feature description or task specification

## Example
```
/implement add progress tracking bar to module completion UI
```

## Quality Gates
Before completion:
- [ ] TypeScript compiles clean
- [ ] Tests pass
- [ ] No lint errors
- [ ] Error boundaries in place

---

Begin implementation of: $ARGUMENTS

Use @implementer agent protocol. Follow HackLearn Pro coding standards.
Track effort (tool calls) for observability metrics.
