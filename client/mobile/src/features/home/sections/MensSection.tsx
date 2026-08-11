import React, { memo } from 'react';
import { mensPicks } from '@data/home/demographics';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

function MensSection(props: SectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Men's Section"
      products={mensPicks}
    />
  );
}


export default memo(MensSection);
