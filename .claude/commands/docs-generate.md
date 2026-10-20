# TypeScript Documentation Generator

## Objective
Generate professional JSDoc/TSDoc documentation for TypeScript modules in `src/` directory following industry standards.

## Steps

### 1. Analyze Source Code
- Read TypeScript files in `src/` directory
- Identify exported functions, classes, interfaces, types
- Extract parameter types, return types, generics

### 2. Generate Documentation
For each export, add comprehensive JSDoc comments including:

**Functions:**
- Description: Clear one-line summary
- `@param`: Parameter descriptions with types
- `@returns`: Return value description
- `@example`: Practical usage examples
- `@template`: Generic type parameters (if applicable)
- `@throws`: Exceptions that may be thrown (if applicable)

**Types/Interfaces:**
- Description: Purpose and usage context
- `@example`: Example values or usage
- Property comments for each field

### 3. Follow TSDoc Standards
- Use `/** */` syntax (not `///`)
- Start with a capital letter
- End with a period
- Use markdown formatting for code: \`code\`
- Use `@example` for code blocks with complete examples

### 4. Validate
- Run `tsc` to ensure no type errors
- Verify examples are accurate and runnable
- Check consistency across all documentation

## Documentation Template

```typescript
/**
 * One-line summary of what this does.
 *
 * More detailed description if needed. Explain the algorithm,
 * edge cases, or important implementation details.
 *
 * @template T - Description of the generic type parameter
 * @param paramName - Description of what this parameter does
 * @param anotherParam - Description with more details
 * @returns Description of the return value and its format
 *
 * @example
 * ```ts
 * import { functionName } from '@jswork/match-first';
 *
 * const result = functionName({
 *   paramName: 'value',
 *   anotherParam: 42
 * });
 * console.log(result); // Expected output
 * ```
 *
 * @throws {Error} When to expect this error
 * @see [RelatedFunction](link) - Cross-reference if applicable
 */
export function functionName<T>(paramName: Type): ReturnType {
  // Implementation
}
```

## Type Documentation Template

```typescript
/**
 * Description of this type's purpose.
 *
 * Use cases and when to prefer this type.
 *
 * @example
 * ```ts
 * const example: TypeName = {
 *   property: 'value'
 * };
 * ```
 */
export interface TypeName {
  /**
   * Description of this property.
   */
  property: string;

  /**
   * Optional property description.
   */
  optionalProperty?: number;
}
```

## TSDoc Standards

| Rule | Specification |
|------|---------------|
| **Syntax** | `/** */` block comments |
| **Summary** | Single sentence, starts with capital, ends with period |
| **Code in text** - Use \`backticks\` |
| **Code blocks** | Use \` \`\` ts \`\` \` fences |
| **Parameters** | `@param paramName - Description` |
| **Returns** | `@returns Description` (not @return) |
| **Examples** | `@example` followed by code block |
| **Generics** | `@template T - Description` |

## Best Practices
1. **Be concise but complete** - Enough detail, no fluff
2. **Show, don't just tell** - Use examples for clarity
3. **Document edge cases** - What happens with empty arrays, null, etc.
4. **Keep examples runnable** - Copy-paste and it works
5. **Use consistent terminology** - Match the code's vocabulary

## Example Usage
```bash
# Given: src/index.ts with matchFirst function needing docs
# Generate: Professional JSDoc comments with @param, @returns, @example
```
