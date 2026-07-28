import React from 'react';
import { 
  ShoppingBag, 
  Utensils, 
  Apple, 
  Pill, 
  Soup, 
  Coffee, 
  Footprints, 
  Headphones, 
  Keyboard, 
  Lightbulb, 
  CupSoda, 
  Salad, 
  Cake, 
  Cookie, 
  Shirt, 
  Sparkles, 
  BriefcaseMedical, 
  Thermometer, 
  Moon, 
  Droplet, 
  Candy, 
  Pizza,
  Flame,
  Star,
  Sparkle
} from 'lucide-react';

// Enterprise-grade mappings for any standard emoji or app type
const iconRegistry: Record<string, React.ComponentType<any>> = {
  // MART / Lifestyle / Tech
  '🛍️': ShoppingBag,
  '👟': Footprints,
  '👡': Footprints,
  '🧥': Shirt,
  '👖': Shirt,
  '👕': Shirt,
  '🎧': Headphones,
  '⌨️': Keyboard,
  '💡': Lightbulb,
  '⌚': ShoppingBag,
  '📱': ShoppingBag,
  '📳': ShoppingBag,
  '🏎️': ShoppingBag,
  '🏋️': ShoppingBag,
  'MART': ShoppingBag,
  'FA_MART': ShoppingBag,

  // FOOD / Dining
  '🍲': Utensils,
  '🥟': Soup,
  '🌯': Utensils,
  '🍟': Pizza,
  '🍵': Coffee,
  '🥞': Cake,
  '🍿': Cookie,
  '🌮': Utensils,
  '🍜': Soup,
  '🥘': Soup,
  '🧇': Cake,
  '🍛': Soup,
  '🍗': Utensils,
  '🧁': Cake,
  '🍰': Cake,
  '🍨': Cake,
  '🍫': Candy,
  '🥤': CupSoda,
  'FOOD': Utensils,

  // GROCERY
  '🍏': Apple,
  '🍎': Apple,
  '🍊': Apple,
  '🥑': Salad,
  '🥦': Salad,
  '🥛': CupSoda,
  '🍞': Cake,
  '🥜': Cookie,
  '🍓': Apple,
  '🥗': Salad,
  '🥫': CupSoda,
  '🧋': CupSoda,
  'GROCERY': Apple,

  // PHARMA / Wellness
  '💊': Pill,
  '🩹': BriefcaseMedical,
  '❄️': Sparkles,
  '🧴': Sparkles,
  '💧': Droplet,
  '💤': Moon,
  '🌡️': Thermometer,
  'PHARMA': Pill,
};

interface EnterpriseIconProps {
  emoji?: string;
  app?: 'FOOD' | 'MART' | 'GROCERY' | 'PHARMA' | 'MASTER_HUB' | 'FA_MART' | string;
  className?: string;
  size?: number;
  variant?: 'circle' | 'flat' | 'square';
}

export default function EnterpriseIcon({ 
  emoji, 
  app, 
  className = '', 
  size = 14,
  variant = 'circle'
}: EnterpriseIconProps) {
  // Find appropriate icon component from registry
  let IconComponent = emoji ? iconRegistry[emoji] : null;
  
  if (!IconComponent && app) {
    IconComponent = iconRegistry[app];
  }

  // Fallback behavior based on app sector
  if (!IconComponent) {
    if (app === 'FOOD') IconComponent = Utensils;
    else if (app === 'GROCERY') IconComponent = Apple;
    else if (app === 'PHARMA') IconComponent = Pill;
    else IconComponent = ShoppingBag;
  }

  // Determine elegant color palettes
  let colorStyles = {
    bg: 'bg-blue-50/95 border-blue-100/80 text-blue-600',
    flat: 'text-blue-600'
  };

  const normalizedApp = app ? app.toUpperCase() : '';

  if (normalizedApp === 'FOOD' || emoji === '🍲' || emoji === '🍜' || emoji === '🥘') {
    colorStyles = {
      bg: 'bg-emerald-50/95 border-emerald-100/80 text-emerald-700',
      flat: 'text-emerald-700'
    };
  } else if (normalizedApp === 'GROCERY' || emoji === '🍏' || emoji === '🍎' || emoji === '🥑') {
    colorStyles = {
      bg: 'bg-green-50/95 border-green-100/80 text-green-700',
      flat: 'text-green-700'
    };
  } else if (normalizedApp === 'PHARMA' || emoji === '💊' || emoji === '🩹' || emoji === '🧴') {
    colorStyles = {
      bg: 'bg-teal-50/95 border-teal-100/80 text-teal-700',
      flat: 'text-teal-700'
    };
  }

  if (variant === 'flat') {
    return <IconComponent size={size} className={`${colorStyles.flat} ${className}`} />;
  }

  const roundedClass = variant === 'circle' ? 'rounded-full' : 'rounded-xl';

  return (
    <div className={`flex items-center justify-center border shrink-0 ${roundedClass} ${colorStyles.bg} ${className}`}>
      <IconComponent size={size} className="stroke-[2.5]" />
    </div>
  );
}
