import React, { memo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Info } from 'lucide-react-native';
import { ms } from '@/utils/responsive';
import { usePageInfo } from '@/lib/usePageInfo';
import InfoSheet from '@/components/shared/InfoSheet';

export type InfoButtonVariant = 'header' | 'badge' | 'bare';

interface InfoButtonProps {
  /** Registry key into PAGE_INFO or COMPONENT_INFO. */
  contentKey: string;
  variant?: InfoButtonVariant;
  /** Icon size override (defaults per variant). */
  size?: number;
  /** Icon colour. */
  color?: string;
  /** Optional circular background behind the icon. */
  backgroundColor?: string;
  accessibilityLabel?: string;
}

/**
 * The reusable "i" guidance button. Resolves plain-English help for a page or
 * component from `pageInfo` and opens a SlideUpSheet. Renders nothing when the
 * key is not registered, so mis-wired keys degrade gracefully.
 *
 * Shared across the customer, delivery and seller apps.
 */
const InfoButton = memo(function InfoButton({
  contentKey,
  variant = 'header',
  size,
  color = '#64748b',
  backgroundColor,
  accessibilityLabel,
}: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const doc = usePageInfo(contentKey);

  if (!doc) return null;

  const iconSize = size ?? (variant === 'badge' ? ms(13) : ms(17));
  const boxSize = iconSize + (variant === 'bare' ? ms(10) : ms(13));

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[
          styles.button,
          { width: boxSize, height: boxSize, borderRadius: boxSize / 2 },
          backgroundColor ? { backgroundColor } : null,
        ]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `About ${doc.title}`}
        accessibilityHint="Opens a short explanation"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Info size={iconSize} color={color} strokeWidth={2.2} />
      </TouchableOpacity>
      <InfoSheet
        visible={open}
        onRequestClose={() => setOpen(false)}
        title={doc.title}
        sections={doc.sections}
        app={doc.app}
      />
    </>
  );
});

export default InfoButton;

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
