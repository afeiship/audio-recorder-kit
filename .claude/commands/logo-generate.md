# Logo Generator

## Objective
Create or update project logos in `assets/logo.svg` following the project branding guidelines.

## Steps

### 1. Analyze Project Identity
- Read `package.json` for project name and description
- Review `src/index.ts` to understand core functionality
- Identify key concepts: matching, conditions, branching, selection

### 2. Design Concept
Create visual metaphors for:
- **Branching**: Decision tree, flow paths, multiple routes
- **Selection**: Checkmarks, highlighted paths, first match emphasis
- **Fallback**: Default route, safety net, base case

### 3. Generate SVG Banner
- Create `assets/logo.svg` as horizontal banner for GitHub
- Use scalable vector graphics for crisp rendering at any size
- Include:
  - **Left side**: Logo icon with branching flow visualization
  - **Right side**: Project name, tagline, and feature badges
  - Color scheme: Dark background (#0f172a), Blue/Purple gradient, Green accents
  - Subtle shadows for depth

### 4. Validate
- Ensure SVG is valid and renders correctly
- Test in both dark and light GitHub themes
- Verify text is readable and layout is balanced

## Design Guidelines

| Aspect | Specification |
|--------|---------------|
| **Format** | SVG (scalable vector) |
| **Location** | `assets/logo.svg` |
| **Dimensions** | 1000x240 (GitHub banner standard) |
| **Background** | Dark (#0f172a) for GitHub compatibility |
| **Primary Color** | Blue to Purple gradient (#3b82f6 → #8b5cf6) |
| **Success Color** | Green gradient (#22c55e → #10b981) |
| **Text Color** | White/light gray (#94a3b8) |
| **Style** | Modern dark theme with subtle shadows |

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [ICON]            match-first                              │
│                     Tagline description                      │
│                     [TypeScript] [Zero Dep] [Tiny]          │
└─────────────────────────────────────────────────────────────┘
```

## Visual Elements
- **Left (200px)**: Logo icon
  - Starting point circle
  - Branching lines (first match highlighted, others dimmed)
  - Green checkmark for first match
  - Gray X marks for non-matches
  - "default" box for fallback
- **Right (800px)**: Content
  - Project name (large, gradient)
  - Tagline (medium, light gray)
  - Feature badges (small, outlined)

## Feature Badges
Common badges to include:
- **TypeScript** - Type safety
- **Zero Dep** - No dependencies
- **Tiny** - Small bundle size

## Example Usage
```bash
# Given: Project "match-first" for conditional value selection
# Generate: assets/logo.svg - 1000x240 dark banner with icon + text
```
