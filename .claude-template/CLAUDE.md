# Matt's Claude Code Configuration

## Identity & Context
You are working with Matt, a Princeton ORFE graduate building HackLearn Pro - an educational platform teaching ethical hacking and AI/ML security through interactive modules. Matt has deep expertise in ML/AI, Bayesian statistics, and reinforcement learning.

## Communication Style
- Be direct and analytical - Matt appreciates systematic thinking
- Skip unnecessary preambles - get to solutions quickly
- Use technical terminology freely - Matt understands ML/AI deeply
- When explaining complex concepts, use mathematical intuition when helpful
- Challenge assumptions constructively - Matt values rigorous thinking

## Development Standards

### Code Quality
- TypeScript preferred for all new code
- Use functional components with hooks in React
- Write comprehensive error handling
- Include tests for new functions (Jest + React Testing Library)
- Follow existing project patterns before introducing new ones

### Architecture Principles
- Prefer composition over inheritance
- Use dependency injection for testability
- Implement proper error boundaries
- Keep components focused and single-purpose
- Document complex logic with clear comments

### File Organization
- Components in `src/components/`
- Utilities in `src/utils/`
- Hooks in `src/hooks/`
- Types in `src/types/`
- Tests alongside source files with `.test.ts` extension

## Project Context: HackLearn Pro
- Primary focus: Interactive learning modules for ethical hacking + AI/ML security
- 30 planned modules with gamification features
- LLM playground components are active development area
- Chain of Thought prompting demonstrations are priority
- Personalization features (account management, subscriptions) in progress

## Multi-Agent Workflow Preferences

### When to Spawn Subagents
- Research tasks requiring deep exploration → @researcher
- Implementation of well-defined features → @implementer  
- Code review and quality checks → @reviewer
- Complex decisions needing multiple perspectives → @consensus
- Long-running project context tracking → @memory-keeper

### Agent Coordination
- Always document agent handoffs in TodoWrite
- Use clear task boundaries between agents
- Aggregate insights before final decisions
- Track agent outputs for observability

## Commands to Know
- `/research [topic]` - Deep dive research with @researcher
- `/implement [feature]` - Systematic implementation with @implementer
- `/review [scope]` - Code review with @reviewer
- `/decide [question]` - Multi-perspective analysis with @consensus
- `/memory [action]` - Long-term project memory operations
- `/test` - Run comprehensive tests
- `/hacklearn [module]` - HackLearn Pro specific workflows

## Testing Requirements
- Run tests before committing: `npm test`
- Ensure >80% coverage on new code
- Include edge cases and error scenarios
- Mock external dependencies appropriately

## Git Workflow
- Use conventional commits: feat:, fix:, docs:, refactor:, test:
- Keep commits atomic and focused
- Write descriptive commit messages
- Reference issue numbers when applicable

## Observability
- Hooks are configured to emit events to the Command Center dashboard
- Track token usage and cost for optimization insights
- Monitor test pass rates and effort metrics
- Review multi-agent coordination patterns regularly

## What Makes Matt's Sessions Optimal
1. Clear task decomposition upfront
2. Aggressive use of subagents for parallel work
3. Continuous test validation
4. Long-term memory tracking for project context
5. Regular observability review for workflow optimization
