# Research Command

Initiate deep research on the specified topic using the @researcher agent.

## Usage
```
/research [topic or question]
```

## Process
1. Spawn @researcher agent
2. Conduct comprehensive exploration:
   - Search codebase for existing implementations
   - Review documentation
   - Web search for best practices
   - Analyze technical specifications
3. Synthesize findings into actionable summary
4. Document in TodoWrite for downstream agents
5. Notify @memory-keeper of significant learnings

## Arguments
$ARGUMENTS - The topic, question, or area to research

## Example
```
/research best practices for implementing CoT prompting in React
```

## Output
Structured research summary with:
- Key findings
- Recommended approach
- Trade-offs analysis
- Open questions
- References

---

Begin research on: $ARGUMENTS

Use @researcher agent protocol. Focus on actionable insights for HackLearn Pro development.
