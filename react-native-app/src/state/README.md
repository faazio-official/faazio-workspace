# State Management (Zustand)

This directory handles central state synchronization across all modules in the React Native app.

## 📁 Key Files
- `store.ts`: Core Zustand hook defining authentication sessions, user profiles, and shopping carts.

## 🛠️ Implementation Standards
- **Precise Slices**: Fetch isolated state slices inside visual views to prevent redundant rendering.
- **Data Privacy**: Avoid saving prescription logs or card credentials directly in global logs.
