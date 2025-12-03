# HackLearn Pro Command

Specialized workflows for HackLearn Pro module development.

## Usage
```
/hacklearn [action] [module-name or arguments]
```

## Actions

### new
Create a new learning module scaffold.
```
/hacklearn new [module-name] [category: hacking|ai-ml|security]
```

### status
Check module completion status.
```
/hacklearn status [module-name or "all"]
```

### interactive
Generate interactive component for module.
```
/hacklearn interactive [component-type] [module-name]
```
Types: quiz, simulation, playground, challenge

### gamify
Add gamification element to module.
```
/hacklearn gamify [element-type] [module-name]
```
Types: badge, progress, leaderboard, achievement

### cot
Generate Chain of Thought demonstration component.
```
/hacklearn cot [topic]
```

## Arguments
$ARGUMENTS - Action and module/component arguments

## Examples
```
/hacklearn new sql-injection hacking
/hacklearn status all
/hacklearn interactive playground llm-basics
/hacklearn gamify badge prompt-engineering
/hacklearn cot transformer-attention
```

## Module Structure
Each module follows:
```
modules/[module-name]/
├── index.tsx           # Module entry
├── content/            # Learning content
├── components/         # Interactive elements
├── challenges/         # Hands-on exercises
├── tests/             # Module tests
└── README.md          # Module documentation
```

## Quality Standards for Modules
- Interactive elements every 2-3 content sections
- At least one hands-on challenge per module
- Gamification hooks integrated
- Mobile-responsive design
- Accessibility compliance (WCAG 2.1 AA)

---

Execute HackLearn workflow: $ARGUMENTS

Use multi-agent coordination as needed:
- @researcher for content research
- @implementer for building
- @reviewer for quality check
- @memory-keeper to track module progress
