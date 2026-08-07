import React from 'react';
import { childrensPicks } from '@data/home/demographics';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

export default function ChildrensSection(props: SectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Children's Section"
      products={childrensPicks}
      appBrand="MART"
    />
  );
}
