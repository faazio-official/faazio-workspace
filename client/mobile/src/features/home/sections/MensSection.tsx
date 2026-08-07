import React from 'react';
import { mensPicks } from '@data/home/demographics';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

export default function MensSection(props: SectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Men's Section"
      products={mensPicks}
      appBrand="MART"
    />
  );
}
