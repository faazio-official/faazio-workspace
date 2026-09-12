# Onboarding Module

This directory handles introducing the Faazio SuperApp values to the user on first launch.

## 📁 Key Files
- `OnboardingScreen.tsx`: Horizontal pager detailing Mart shopping, Food, e-Booking, and E-Services capabilities, with a 5th blood-donation finale slide (variant layout, red accent).

## 🛠️ Implementation Standards
- **Aesthetic Transitions**: Integrates customized animated indicators matching current screen colors.
- **Edge-to-Edge Bounds**: Configured to scale perfectly without causing standard scrolls.
- **Data-driven slides**: The `OnboardingStep` model drives per-slide accent color, optional two-tone title/tagline, gradient backdrop, floating badges, and a final-step login-link footer variant.
