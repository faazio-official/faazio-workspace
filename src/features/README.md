# Feature Modules Guidelines

This directory houses module-specific business logic and screen-specific helper components.

## 📁 Folder Structure (Future Expansion)
- `auth/`: Screens & logic for user sign-in, signup, OTP, and profile verification.
- `ecommerce/`: Catalog, product lists, cart overlays, and checkout screens.
- `dinner-booking/`: Restaurant selectors, table reservation calendars, and confirmation boards.
- `pharma/`: Prescription cameras, drug directories, and healthcare checkout systems.

## 🛠️ Design Patterns
- **Isolation**: Keep features self-contained. Avoid tight coupling across different feature modules.
- **Widgets**: Extract module-specific UI elements inside subfolders of their respective module (e.g., `features/ecommerce/components/`).
- **Auto-Update**: On modifying features, synchronize route and navigator listings inside `AppNavigator.tsx` / `App.tsx`.
