import React, { memo, useEffect, useState } from 'react';
import type { SduiScreenLayout, SduiWidget } from '@/services/api/sduiLayout';
import { selectHeroWidget } from './heroResolver';
import SduiHeroBanner from './SduiHeroBanner';

interface Props {
  layout: SduiScreenLayout | null;
  /** Server clock minus device clock, ms. Owned by `useSduiScreenLayout`. */
  clockOffset: number;
  onPress: (widget: SduiWidget) => void;
}

/**
 * The `hero_banner` slot. Keeps its own one-second tick so the countdown and the
 * expiry swap re-render only this subtree, never the whole food home.
 * Renders nothing when the live layout has no hero that can display right now.
 */
const SduiHeroSlot = memo(function SduiHeroSlot({ layout, clockOffset, onPress }: Props) {
  const [now, setNow] = useState(() => Date.now() + clockOffset);

  useEffect(() => {
    setNow(Date.now() + clockOffset);
  }, [clockOffset, layout]);

  useEffect(() => {
    if (!layout) return;
    const id = setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => clearInterval(id);
  }, [layout, clockOffset]);

  const hero = layout ? selectHeroWidget(layout.widgets, now) : null;
  if (!hero) return null;
  return <SduiHeroBanner widget={hero} now={now} onPress={onPress} />;
});

export default SduiHeroSlot;
