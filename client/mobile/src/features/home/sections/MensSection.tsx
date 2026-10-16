import React, { memo } from 'react';
import { mensPicks } from '@data/home/demographics';
import type { Product } from '@data/types';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

interface MensSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture for first paint / offline. */
  products?: Product[];
}

function MensSection({ products = mensPicks, ...props }: MensSectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Men's Section"
      products={products}
    />
  );
}


export default memo(MensSection);