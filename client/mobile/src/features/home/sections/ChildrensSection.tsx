import React, { memo } from 'react';
import { childrensPicks } from '@data/home/demographics';
import AudienceGridSection from './AudienceGridSection';
import type { SectionProps } from './common';

function ChildrensSection(props: SectionProps) {
  return (
    <AudienceGridSection
      {...props}
      title="Children's Section"
      products={childrensPicks}
    />
  );
}


export default memo(ChildrensSection);
