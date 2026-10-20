# Test Generator

## Objective
Analyze source code and generate comprehensive test suites following project conventions.

## Steps

### 1. Analyze Source Code
- Scan `src/` directory for TypeScript modules
- Identify exported functions, classes, and types
- Review existing tests in `__tests__/` to avoid duplication

### 2. Design Test Coverage
For each module, ensure coverage of:
- **Happy paths**: Normal usage scenarios
- **Edge cases**: Boundary values, empty inputs, null/undefined
- **Error cases**: Invalid inputs, exceptions
- **Type safety**: Different value types if generic

### 3. Generate Tests
- Create new `*.spec.ts` files in `__tests__/` directory
- Match file structure: `src/foo.ts` → `__tests__/foo.spec.ts`
- Keep test files focused and modular
- Use `describe` blocks for logical grouping
- Write descriptive test names using `should...` or `when...` pattern

### 4. Validate
- Run `bun test` to verify all tests pass
- Ensure no syntax errors or type errors

## Testing Conventions

| Aspect | Specification |
|--------|---------------|
| **Test Runner** | `bun test` |
| **Test Directory** | `__tests__/` |
| **File Naming** | `*.spec.ts` suffix |
| **Import Path** | Use `../src` or configured module alias |
| **Assertion Style** | `expect(actual).toBe(expected)` |
| **Organization** | One test file per source module, split by feature |

## Test Structure Template

```typescript
import { functionName } from '../src/module';

describe('functionName', () => {
  describe('should handle happy paths', () => {
    it('when given valid input', () => {
      const result = functionName(validInput);
      expect(result).toBe(expectedOutput);
    });
  });

  describe('should handle edge cases', () => {
    it('when input is empty', () => {
      const result = functionName(emptyInput);
      expect(result).toBe(expectedOutput);
    });
  });

  describe('should handle errors', () => {
    it('when input is invalid', () => {
      expect(() => functionName(invalidInput)).toThrow();
    });
  });
});
```

## Example
```bash
# Given: src/utils.ts with export function formatDate()
# Generate: __tests__/utils.spec.ts with comprehensive date format tests
```
