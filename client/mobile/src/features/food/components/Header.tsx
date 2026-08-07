import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, ChevronDown, Bell } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

const PROFILE_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120&h=120';

interface HeaderProps {
  area?: string;
  address?: string;
  onAreaPress?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

/**
 * Food location header. Lives at the top of the scroll content (root tab of the
 * Food sub-app → no back button). Location left, notification + profile right.
 */
const Header = memo(function Header({
  area = 'Anna Nagar',
  address = 'Delivering to Home',
  onAreaPress,
  onNotificationPress,
  onProfilePress,
}: HeaderProps) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.row}>
      <TouchableOpacity
        style={styles.location}
        onPress={onAreaPress}
        accessibilityRole="button"
        accessibilityLabel={`Location: ${area}. Change delivery area`}
        accessibilityHint="Opens area selector"
      >
        <MapPin size={ms(24)} color={foodTheme.primary} strokeWidth={2.2} />
        <View style={styles.locationTextWrap}>
          <View style={styles.areaRow}>
            <AppText style={styles.area} numberOfLines={1}>
              {area}
            </AppText>
            <ChevronDown size={ms(18)} color={foodTheme.textPrimary} strokeWidth={2.4} />
          </View>
          <AppText style={styles.address} numberOfLines={1}>
            {address}
          </AppText>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onNotificationPress}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Bell size={ms(26)} color={foodTheme.textPrimary} strokeWidth={2} />
          <View style={styles.notifDot} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileBtn}
          onPress={onProfilePress}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <ExpoImage
            source={{ uri: PROFILE_AVATAR }}
            style={styles.profileImg}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

export default Header;

const styles = StyleSheet.create({
  row: {
    minHeight: vs(90),
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: foodTheme.background,
  },
  location: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    minHeight: vs(48),
    marginRight: hs(8),
  },
  locationTextWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: vs(2),
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
  },
  area: {
    fontSize: ms(20),
    fontWeight: '600',
    color: foodTheme.textPrimary,
    flexShrink: 1,
  },
  address: {
    fontSize: ms(14),
    fontWeight: '400',
    color: foodTheme.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  iconBtn: {
    width: ms(44),
    height: vs(44),
    borderRadius: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: vs(8),
    right: hs(8),
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: foodTheme.primary,
    borderWidth: 1.5,
    borderColor: foodTheme.background,
  },
  profileBtn: {
    width: ms(44),
    height: vs(44),
    borderRadius: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImg: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    borderWidth: 2,
    borderColor: foodTheme.primaryLight,
  },
});
