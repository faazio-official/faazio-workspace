import React, { memo } from 'react';
import { womensPicks } from '@data/home/demographics';
import type { Product } from '@data/types';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

interface WomensSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture for first paint / offline. */
  products?: Product[];
}

function WomensSection({ products = womensPicks, ...props }: WomensSectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Women's Section"
      products={products}
    />
  );
}


export default memo(WomensSection);