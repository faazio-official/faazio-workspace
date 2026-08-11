import React, { memo } from 'react';
import { womensPicks } from '@data/home/demographics';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

function WomensSection(props: SectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Women's Section"
      products={womensPicks}
    />
  );
}


export default memo(WomensSection);
