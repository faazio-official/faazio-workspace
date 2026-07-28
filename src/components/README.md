# Global Components Guidelines

This directory is designated for highly reusable, presentational UI components.

## 📐 Implementation Standards
- **Pure & Presentation-Only**: Components must not fetch or bind global state directly. Use props for custom configurations.
- **Tailwind Only**: Style exclusively with Tailwind CSS utility classes.
- **Interactive States**: Always include appropriate hover, active, and focus styles (`hover:`, `active:`, `focus-visible:`).
- **TypeScript**: Strictly type props and generic types. Avoid the use of `any`.

## 🔄 Auto-Update & Extension
- When adding or changing a component inside this directory, ensure all relevant exports are listed clearly.
- If components have visual updates, run the compiler (`npm run build`) to guarantee code correctness.
