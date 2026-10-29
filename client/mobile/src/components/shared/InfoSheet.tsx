import React, { memo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Info as InfoIcon } from 'lucide-react-native';
import AppText from '@/components/AppText';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { hs, ms, vs } from '@/utils/responsive';
import type { AppScope, InfoSection } from '@/lib/pageInfo';

interface InfoSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  sections: InfoSection[];
  app?: AppScope;
}

const APP_LABEL: Record<AppScope, string> = {
  customer: 'Faazio app',
  delivery: 'Delivery Partner',
  seller: 'Seller Partner',
  all: 'All Faazio apps',
};

/**
 * Shared disclosure surface for the "i" InfoButton. Slides up over the current
 * screen (reusing SlideUpSheet) so full-viewport, non-scrollable pages stay
 * intact. Renders labelled plain-English sections plus a dismiss button.
 */
const InfoSheet = memo(function InfoSheet({
  visible,
  onRequestClose,
  title,
  sections,
  app,
}: InfoSheetProps) {
  return (
    <SlideUpSheet visible={visible} onRequestClose={onRequestClose}>
      <View style={styles.grabBar} />
      <View style={styles.headerRow}>
        <View style={styles.iconBubble}>
          <InfoIcon size={ms(18)} color="#1162D3" strokeWidth={2.2} />
        </View>
        <View style={styles.headerText}>
          <AppText style={styles.title}>{title}</AppText>
          {app ? <AppText style={styles.appLabel}>{APP_LABEL[app]}</AppText> : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, index) => (
          <View key={`${section.label}-${index}`} style={styles.section}>
            <AppText style={styles.sectionLabel}>{section.label}</AppText>
            <AppText style={styles.sectionBody}>{section.body}</AppText>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={styles.gotIt}
        onPress={onRequestClose}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Close help"
      >
        <AppText style={styles.gotItText}>Got it</AppText>
      </TouchableOpacity>
    </SlideUpSheet>
  );
});

export default InfoSheet;

const styles = StyleSheet.create({
  grabBar: {
    width: hs(44),
    height: vs(4),
    borderRadius: ms(2),
    backgroundColor: '#CBD5E1',
    marginBottom: vs(14),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    width: '100%',
    marginBottom: vs(14),
  },
  iconBubble: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
  },
  appLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#64748b',
    marginTop: vs(2),
  },
  scroll: {
    width: '100%',
    maxHeight: vs(360),
  },
  scrollContent: {
    paddingBottom: vs(8),
    gap: vs(14),
  },
  section: {
    width: '100%',
  },
  sectionLabel: {
    fontSize: ms(11),
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#1162D3',
    marginBottom: vs(4),
  },
  sectionBody: {
    fontSize: ms(13.5),
    fontWeight: '500',
    lineHeight: ms(20),
    color: '#334155',
  },
  gotIt: {
    width: '100%',
    height: vs(50),
    borderRadius: ms(14),
    backgroundColor: '#1162D3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(12),
  },
  gotItText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
});
