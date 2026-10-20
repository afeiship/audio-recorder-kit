# LLMs.txt Generator

## Objective
Generate `llms.txt` file to help AI tools (Cursor, Copilot Workspace, etc.) understand the project and provide better code assistance.

## Steps

### 1. Analyze Project
- Read `package.json` for project metadata (name, description, version, homepage)
- Read `README.md` for existing documentation
- Scan `src/` directory to understand the codebase structure
- Identify main exports and their purposes

### 2. Generate Content
Create `llms.txt` with the following sections:

**Required Sections:**
- **Overview** - Brief project description
- **Quick Start** - Installation and basic usage
- **API Reference** - Main functions, classes, types with descriptions
- **Use Cases** - Common usage scenarios
- **Examples** - Practical code examples
- **Project Structure** - Directory layout
- **Development** - Build, test, and release commands
- **Links** - Repository, NPM, homepage

**Optional Sections:**
- **Features** - Key selling points
- **Motivation** - Why this project exists
- **Comparison** - How it differs from alternatives
- **Contributing** - How to contribute

### 3. Formatting Rules
- Use markdown format
- Include code blocks with syntax highlighting
- Use bullet points and tables for readability
- Keep descriptions concise but informative
- Prioritize information that helps AI understand context

### 4. Validate
- Ensure all code examples are accurate
- Verify links are correct
- Check that API docs match the actual exports

## Content Template

```markdown
# [project-name]

> [one-line description from package.json]

## Overview

[2-3 sentences explaining what the project does and who it's for]

## Installation

```bash
npm install [package-name]
# or
yarn add [package-name]
# or
pnpm add [package-name]
```

## Quick Start

```typescript
import [main-export] from '[package-name]';

// Brief, complete example
```

## API

### [main-export]

[Description of what it does]

**Parameters:**
- `param1` - Description
- `param2` - Description

**Returns:** Description

**Type Definition:**
```typescript
// Main type signatures
```

## Use Cases

1. **Use case 1** - Description
2. **Use case 2** - Description
3. **Use case 3** - Description

## Examples

### Example Name

```typescript
// Complete, runnable example
```

## Features

- **Feature 1** - Description
- **Feature 2** - Description
- **Feature 3** - Description

## Project Structure

```
project-name/
├── src/              # Source code
├── __tests__/        # Test files
├── dist/            # Build output
└── package.json
```

## Development

```bash
# Run tests
[npm test or bun test]

# Build
[npm run build]

# Release
[npm run release]
```

## Links

- **Repository**: [GitHub URL]
- **NPM**: [npmjs.org URL]
- **Homepage**: [Project homepage]

## License

[License from package.json]
```

## Best Practices

1. **Be Accurate** - All code examples must be runnable
2. **Be Concise** - Prioritize essential information
3. **Be Current** - Match the actual codebase state
4. **Be Specific** - Include type signatures and concrete examples
5. **Be Organized** - Use clear headings and logical flow

## Information Sources

| Source | What to Extract |
|--------|-----------------|
| `package.json` | name, description, version, keywords, homepage, license |
| `README.md` | usage examples, installation, features |
| `src/**/*.ts` | exports, types, APIs |
| `__tests__/**/*.spec.ts` | usage patterns, examples |

## Example Usage
```bash
# Given: A TypeScript package with exports in src/index.ts
# Generate: llms.txt with overview, API docs, examples, and structure
```
