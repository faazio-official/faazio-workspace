import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Coins, Info } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import { BRAND } from '../constants';
import { COIN_REDEEM_RATE } from '@data/rewards/rewards';
import { computeRedeemableRupees, coinsForRedemption } from '@/features/rewards/rewardsLogic';

interface CoinsRedeemRowProps {
  /** User's current FaazioCoin balance (row hidden by caller when < min). */
  coinBalance: number;
  /** Reports the redeemed rupee value (0 when unchecked) to the parent. */
  onToggle: (checked: boolean, redeemRupees: number) => void;
}

/**
 * Opt-in "Use my FaazioCoins" row shown in the payment step when the user has
 * at least the minimum redeemable coins. Redeems whole rupees of coins and
 * reports the adjusted value up so the pay total updates.
 */
export default function CoinsRedeemRow({ coinBalance, onToggle }: CoinsRedeemRowProps) {
  const [checked, setChecked] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);

  const redeemRupees = computeRedeemableRupees(coinBalance);
  const coinsToUse = coinsForRedemption(redeemRupees);
  const canRedeem = redeemRupees > 0;

  const handleToggle = () => {
    const next = !checked;
    setChecked(next);
    onToggle(next, next ? redeemRupees : 0);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Coins size={ms(18)} color="#B45309" strokeWidth={2.2} />
        </View>
        <TouchableOpacity
          style={styles.body}
          onPress={handleToggle}
          activeOpacity={0.7}
          disabled={!canRedeem}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <AppText style={styles.title}>Use my FaazioCoins</AppText>
          <AppText style={styles.subtitle}>
            {coinBalance.toLocaleString('en-IN')} coins available
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setInfoVisible((v) => !v)}
          style={styles.infoBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="How coin redemption works"
        >
          <Info size={ms(15)} color="#9CA3AF" strokeWidth={2.2} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleToggle}
          style={[styles.checkbox, checked && styles.checkboxChecked]}
          activeOpacity={0.7}
          disabled={!canRedeem}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          {checked && <AppText style={styles.checkboxCheck}>✓</AppText>}
        </TouchableOpacity>
      </View>

      {checked && canRedeem && (
        <View style={styles.savingRow}>
          <AppText style={styles.savingLabel}>Coins used ({coinsToUse})</AppText>
          <AppText style={styles.savingValue}>−₹{redeemRupees.toLocaleString('en-IN')}</AppText>
        </View>
      )}

      {infoVisible && (
        <View style={styles.infoBox}>
          <AppText style={styles.infoText}>
            {COIN_REDEEM_RATE} coins = ₹1. We redeem in whole rupees, so you'll use {coinsToUse} coins
            for ₹{redeemRupees} off this order. Coins are earned on the amount you actually pay.
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: hs(14),
    marginBottom: SPACE.SECTION,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(11),
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  body: {
    flex: 1,
    marginRight: hs(6),
  },
  title: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BRAND.ink,
  },
  subtitle: {
    fontSize: ms(11),
    color: '#6B7280',
    marginTop: vs(2),
  },
  infoBtn: {
    padding: hs(6),
  },
  checkbox: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(7),
    borderWidth: 1.6,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: hs(6),
  },
  checkboxChecked: {
    backgroundColor: BRAND.green,
    borderColor: BRAND.green,
  },
  checkboxCheck: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#ffffff',
  },
  savingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACE.ITEM,
    paddingTop: SPACE.ITEM,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
  },
  savingLabel: {
    fontSize: ms(12),
    color: '#6B7280',
    fontWeight: '600',
  },
  savingValue: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#059669',
  },
  infoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: ms(10),
    padding: hs(10),
    marginTop: SPACE.ITEM,
  },
  infoText: {
    fontSize: ms(11),
    color: '#64748B',
    lineHeight: ms(16),
  },
});
