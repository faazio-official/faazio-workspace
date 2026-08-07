import React from 'react';
import { womensPicks } from '@data/home/demographics';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

export default function WomensSection(props: SectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Women's Section"
      products={womensPicks}
      appBrand="MART"
    />
  );
}
