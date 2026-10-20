# README Updater

## Objective
Update the `README.md` usage section to reflect the current API from `src/index.ts`.

## Steps

### 1. Analyze Source Code
- Read `src/index.ts` to understand exported functions
- Extract function signatures and JSDoc examples
- Identify parameters, return types, and usage patterns

### 2. Review Current README
- Read existing `README.md`
- Identify the outdated `## usage` section

### 3. Generate Usage Examples
Create comprehensive examples covering:
- Basic usage with simple conditions
- Multiple condition cases
- Different value types (string, number, object)
- Fallback behavior
- Real-world scenarios

### 4. Update README
- Replace the `## usage` section with accurate examples
- Match code style and formatting of the existing README
- Ensure TypeScript syntax is properly highlighted

## Usage Section Template

```markdown
## usage
```typescript
import { matchFirst } from '@jswork/match-first';

// Basic example: return first matching value
const result = matchFirst(
  [
    { condition: isHotfix, value: `hotfix ${id}` },
    { condition: taskType === 'bug', value: `bugfix ${id}` }
  ],
  `start ${id}`
);

// Fallback when no conditions match
const value = matchFirst(
  [
    { condition: x > 10, value: 'large' },
    { condition: x > 5, value: 'medium' }
  ],
  'small'
);
```
```

## Formatting Rules
- Use TypeScript syntax highlighting
- Keep examples concise but informative
- Show realistic use cases
- Maintain consistency with existing README style
