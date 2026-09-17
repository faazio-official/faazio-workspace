import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { StoreProfile } from '@data/types';
import PharmaSectionHeader from './PharmaSectionHeader';
import LocalMedicalCard from './LocalMedicalCard';

interface LocalMedicalsRailProps {
  stores: StoreProfile[];
  onMedicalPress?: (store: StoreProfile) => void;
}

const LocalMedicalsRail = memo(function LocalMedicalsRail({ stores, onMedicalPress }: LocalMedicalsRailProps) {
  return (
    <View style={styles.wrap}>
      <PharmaSectionHeader title="Local Medicals Near You" />
      <View style={styles.list}>
        {stores.map((store) => (
          <LocalMedicalCard key={store.id} store={store} onPress={onMedicalPress} />
        ))}
        {stores.length === 0 ? (
          <View style={styles.emptyWrap}>
            <AppText style={styles.emptyText}>No medicals found</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
});

export default LocalMedicalsRail;

const styles = StyleSheet.create({
  wrap: { paddingVertical: vs(8) },
  list: { gap: hs(10), paddingBottom: vs(4) },
  emptyWrap: { alignItems: 'center', paddingVertical: vs(24) },
  emptyText: { fontSize: ms(12), fontWeight: '600', color: '#94A3B8' },
});
