# Global State Guidelines

This directory handles central state synchronization across the Faazio app.

## ⚙️ Zustand & State Strategy
- **Central Store**: Shared or persistent state must reside in `src/state/store.ts` (or modular files in this directory).
- **Selectors**: Always retrieve state slices using Zustand selector functions to avoid unnecessary component re-renders:
  ```ts
  const user = useAuthStore((state) => state.user);
  ```
- **Local vs Global**: Use standard React `useState` for transient visual elements (like keyboard active states or dropdown toggles). Do not pollute the global store.

## 🔄 Auto-Update & Extension
- When adding new state slices, ensure they are fully typed.
- If state keys are modified, update all dependent consumer components instantly.
