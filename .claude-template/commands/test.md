# Test Command

Run comprehensive tests and generate coverage report.

## Usage
```
/test [scope - optional file or feature]
```

## Process
1. Identify test scope
2. Run test suite:
   ```bash
   npm test -- --coverage $ARGUMENTS
   ```
3. Analyze results:
   - Pass/fail summary
   - Coverage metrics
   - Failed test details
4. Compare to baseline (from @memory-keeper)
5. Update observability metrics
6. Report findings

## Arguments
$ARGUMENTS - Optional: specific file, feature, or test pattern

## Examples
```
/test                           # Run all tests
/test src/components/           # Test components directory
/test ModulePlayer              # Test files matching pattern
/test --watch                   # Watch mode
```

## Output Includes
- Test pass rate (tracked in observability)
- Coverage percentage by file
- Failed test analysis
- Recommendations for missing coverage
- Comparison to project baseline

## Quality Gates
For HackLearn Pro:
- Minimum 80% coverage on new code
- All existing tests must pass
- Security-related code requires 90%+ coverage

---

Execute test command: $ARGUMENTS

Track results for Command Center observability dashboard.
Report test pass rate metric.
