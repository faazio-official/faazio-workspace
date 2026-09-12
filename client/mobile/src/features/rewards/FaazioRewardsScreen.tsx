import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Coins,
  Info,
  Ticket,
  TrendingUp,
  Clock,
  Gift,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { useRewardsStore } from '@/state/rewardsStore';
import {
  STREAK_TARGET_DAYS,
  COIN_EARN_RATE,
  COIN_REDEEM_RATE,
} from '@data/rewards/rewards';
import type { RootStackParamList } from '@/navigation/types';
import type { RewardLedgerEntry } from '@/state/rewardsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'FaazioRewards'>;

const LEDGER_META: Record<
  RewardLedgerEntry['type'],
  { label: string; color: string; sign: (e: RewardLedgerEntry) => string }
> = {
  EARN: { label: 'Coins earned', color: '#059669', sign: () => '+' },
  REDEEM: { label: 'Coins redeemed', color: '#D97706', sign: () => '−' },
  EXPIRE: { label: 'Card expired', color: '#94A3B8', sign: () => '' },
  STREAK: { label: '7-day streak reward', color: '#7C3AED', sign: () => '🎉' },
};

function formatLedgerDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function FaazioRewardsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const coinBalance = useRewardsStore((s) => s.coinBalance);
  const streakCount = useRewardsStore((s) => s.streakCount);
  const discountCard = useRewardsStore((s) => s.discountCard);
  const ledger = useRewardsStore((s) => s.ledger);
  const [infoVisible, setInfoVisible] = useState(false);

  const handleBack = () => navigation.goBack();

  const cardActive = !!discountCard;
  const cardDaysLeft = useMemo(() => {
    if (!discountCard) return 0;
    const diff = new Date(discountCard.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
  }, [discountCard]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>FaazioRewards</AppText>
          <View style={{ width: ms(40) }} />
        </View>

        {/* Coin balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View style={styles.balanceIcon}>
              <Coins size={ms(22)} color="#B45309" strokeWidth={2.2} />
            </View>
            <TouchableOpacity
              onPress={() => setInfoVisible(true)}
              style={styles.infoBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="How FaazioCoins work"
            >
              <Info size={ms(16)} color="#FDE68A" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          <AppText style={styles.balanceLabel}>FaazioCoins</AppText>
          <AppText style={styles.balanceValue}>{coinBalance.toLocaleString('en-IN')}</AppText>
          <AppText style={styles.balanceHint}>
            1 coin = ₹{(1 / COIN_REDEEM_RATE).toFixed(2)} · Redeem in whole rupees
          </AppText>
        </View>

        {/* Streak strip */}
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Order streak</AppText>
          <View style={styles.streakRow}>
            {Array.from({ length: STREAK_TARGET_DAYS }).map((_, i) => {
              const filled = i < streakCount;
              return (
                <View key={i} style={[styles.streakDot, filled && styles.streakDotFilled]}>
                  {filled && <AppText style={styles.streakDotCheck}>✓</AppText>}
                </View>
              );
            })}
          </View>
          <AppText style={styles.streakCaption}>
            {streakCount > 0
              ? `${streakCount} of ${STREAK_TARGET_DAYS} days — order today to keep your streak.`
              : `Order ${STREAK_TARGET_DAYS} days in a row to earn a 10% discount card.`}
          </AppText>
          <AppText style={styles.streakNote}>Miss a day and it resets.</AppText>
        </View>

        {/* Active discount card / empty state */}
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Your rewards</AppText>
          {cardActive && discountCard ? (
            <View style={styles.discountCardBox}>
              <View style={styles.discountIcon}>
                <Ticket size={ms(20)} color="#7C3AED" strokeWidth={2.2} />
              </View>
              <View style={styles.discountBody}>
                <AppText style={styles.discountTitle}>Faazio Streak — {discountCard.percent}% OFF</AppText>
                <AppText style={styles.discountSub}>
                  Valid for {cardDaysLeft} more {cardDaysLeft === 1 ? 'day' : 'days'}
                </AppText>
              </View>
            </View>
          ) : (
            <View style={styles.emptyReward}>
              <Gift size={ms(20)} color="#94A3B8" strokeWidth={2} />
              <AppText style={styles.emptyRewardText}>
                Complete a {STREAK_TARGET_DAYS}-day streak to unlock your discount card.
              </AppText>
            </View>
          )}
        </View>

        {/* Ledger */}
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Activity</AppText>
          {ledger.length === 0 ? (
            <View style={styles.emptyLedger}>
              <Clock size={ms(18)} color="#CBD5E1" strokeWidth={2} />
              <AppText style={styles.emptyLedgerText}>No activity yet — place an order to earn coins.</AppText>
            </View>
          ) : (
            ledger.map((entry) => {
              const meta = LEDGER_META[entry.type];
              const Icon = entry.type === 'STREAK' ? Ticket : entry.type === 'REDEEM' ? Coins : TrendingUp;
              return (
                <View key={entry.id} style={styles.ledgerRow}>
                  <View style={styles.ledgerIcon}>
                    <Icon size={ms(15)} color={meta.color} strokeWidth={2.2} />
                  </View>
                  <View style={styles.ledgerText}>
                    <AppText style={styles.ledgerTitle}>{meta.label}</AppText>
                    <AppText style={styles.ledgerDate}>{formatLedgerDate(entry.at)}</AppText>
                  </View>
                  <AppText style={[styles.ledgerValue, { color: meta.color }]}>
                    {meta.sign(entry)}
                    {Math.abs(entry.coins)}
                  </AppText>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Explain how coins work */}
      <SlideUpSheet visible={infoVisible} onRequestClose={() => setInfoVisible(false)}>
        <AppText style={styles.sheetTitle}>How FaazioCoins work</AppText>
        <View style={styles.infoRow}>
          <AppText style={styles.infoBullet}>•</AppText>
          <AppText style={styles.infoText}>
            Earn 1 coin for every ₹{COIN_EARN_RATE.toLocaleString('en-IN')} you spend on an order.
          </AppText>
        </View>
        <View style={styles.infoRow}>
          <AppText style={styles.infoBullet}>•</AppText>
          <AppText style={styles.infoText}>
            Redeem coins at checkout — {COIN_REDEEM_RATE} coins = ₹1, in whole-rupee steps
            (minimum {COIN_REDEEM_RATE} coins).
          </AppText>
        </View>
        <View style={styles.infoRow}>
          <AppText style={styles.infoBullet}>•</AppText>
          <AppText style={styles.infoText}>
            Order {STREAK_TARGET_DAYS} days in a row to unlock a 10% discount card, valid for 5 days.
          </AppText>
        </View>
      </SlideUpSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(32),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
  },
  backButton: {
    width: ms(40),
    height: ms(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
  },
  balanceCard: {
    backgroundColor: '#7C3AED',
    borderRadius: ms(20),
    padding: hs(18),
    marginBottom: vs(14),
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtn: {
    width: ms(32),
    height: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#EDE9FE',
    marginTop: vs(14),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: ms(34),
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: vs(2),
  },
  balanceHint: {
    fontSize: ms(11),
    color: '#DDD6FE',
    marginTop: vs(4),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    padding: hs(16),
    marginBottom: vs(12),
  },
  cardTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: vs(12),
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakDot: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDotFilled: {
    borderColor: '#7C3AED',
    backgroundColor: '#7C3AED',
  },
  streakDotCheck: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  streakCaption: {
    fontSize: ms(11.5),
    color: '#475569',
    fontWeight: '600',
    marginTop: vs(12),
  },
  streakNote: {
    fontSize: ms(10.5),
    color: '#94A3B8',
    marginTop: vs(2),
  },
  discountCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: ms(14),
    padding: hs(12),
  },
  discountIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBody: {
    marginLeft: hs(12),
    flex: 1,
  },
  discountTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#5B21B6',
  },
  discountSub: {
    fontSize: ms(11),
    color: '#7C3AED',
    marginTop: vs(2),
  },
  emptyReward: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: ms(14),
    padding: hs(12),
  },
  emptyRewardText: {
    fontSize: ms(11.5),
    color: '#64748B',
    marginLeft: hs(10),
    flex: 1,
  },
  emptyLedger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(6),
  },
  emptyLedgerText: {
    fontSize: ms(11.5),
    color: '#94A3B8',
    marginLeft: hs(8),
    flex: 1,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(9),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  ledgerIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(10),
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerText: {
    flex: 1,
    marginLeft: hs(10),
  },
  ledgerTitle: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#0f172a',
  },
  ledgerDate: {
    fontSize: ms(10),
    color: '#94A3B8',
    marginTop: vs(1),
  },
  ledgerValue: {
    fontSize: ms(13),
    fontWeight: '900',
  },
  sheetTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(12),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: vs(10),
  },
  infoBullet: {
    fontSize: ms(13),
    color: '#7C3AED',
    fontWeight: '900',
    marginRight: hs(8),
  },
  infoText: {
    fontSize: ms(12.5),
    color: '#475569',
    lineHeight: ms(18),
    flex: 1,
  },
});
