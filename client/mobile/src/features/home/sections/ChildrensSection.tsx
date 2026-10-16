import React, { memo } from 'react';
import { childrensPicks } from '@data/home/demographics';
import type { Product } from '@data/types';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

interface ChildrensSectionProps extends SectionProps {
  /** SDUI feed rows; falls back to the local fixture for first paint / offline. */
  products?: Product[];
}

function ChildrensSection({ products = childrensPicks, ...props }: ChildrensSectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Children's Section"
      products={products}
    />
  );
}


export default memo(ChildrensSection);