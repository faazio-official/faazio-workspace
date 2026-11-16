import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, vs } from '@/utils/responsive';

interface DPPageProps {
  children: React.ReactNode;
  /** Pull-to-refresh; omit when the screen has no reload path. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** Keep the focused field above the keyboard on the auth/registration forms. */
  keyboardAvoiding?: boolean;
  /** Non-scrolling content pinned above the scroll body (e.g. a utility bar). */
  header?: React.ReactNode;
}

/** Full-bleed page: safe-area top + scroll body on `surface`. */
export function DPPage({
  children,
  refreshControl,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
  keyboardAvoiding = false,
  header,
}: DPPageProps) {
  const insets = useSafeAreaInsets();
  const scroll = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      {header}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.scroll}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {scroll}
        </KeyboardAvoidingView>
      ) : (
        scroll
      )}
    </View>
  );
}

interface DPPageHeaderProps {
  title: string;
  description?: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Page header: title + optional description + actions row. No kicker/eyebrow label. */
export function DPPageHeader({
  title,
  description,
  leading,
  actions,
}: DPPageHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.headerText}>
          <AppText style={styles.title}>{title}</AppText>
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {description ? <AppText style={styles.description}>{description}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: DELIVERY.surface },
  scroll: { flex: 1 },
  content: { padding: hs(16), paddingBottom: DELIVERY.space.LIST_BOTTOM },
  header: { marginTop: vs(8), marginBottom: vs(16) },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(8) },
  leading: { paddingTop: vs(2) },
  headerText: { flex: 1 },
  title: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '500', marginTop: vs(4) },
  description: { ...DP_TYPE.body, color: DELIVERY.inkMuted, marginTop: vs(8) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: hs(8) },
});