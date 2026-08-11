/**
 * Local hero banners (AVIF) — kept in `src/assets/food` (consolidated with the
 * rest of the app assets). These are the ONLY local assets used by the Food
 * sub-app. Every other restaurant / dish image is a web URL inside the mock
 * data layer.
 */
export const DINING_BANNER = require('@/assets/food/food_subapp_home_page_dining.avif');
export const ORDER_FOOD_BANNER = require('@/assets/food/food_subapp_home_page_order_food.avif');

/**
 * Network fallbacks. Used when a web image fails to load or when the local
 * AVIF banner cannot be decoded on an older OS. Kept in the same shape so the
 * consuming components can swap transparently.
 */
export const FALLBACK_RESTAURANT_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?fm=jpg&fit=crop&q=80&w=800&h=600';

export const FALLBACK_DISH_IMAGE =
  'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=500&h=500';

export const FALLBACK_MODE_BANNER_DINING =
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?fm=jpg&fit=crop&q=80&w=800&h=600';

export const FALLBACK_MODE_BANNER_ORDER =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?fm=jpg&fit=crop&q=80&w=800&h=600';
