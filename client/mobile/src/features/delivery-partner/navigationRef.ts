import { createNavigationContainerRef } from '@react-navigation/native';
import type { DeliveryPartnerStackParamList } from './navigation';

/** Partner-stack navigation handle for non-screen code (FCM taps, deep links, logout). */
export const deliveryNavigationRef = createNavigationContainerRef<DeliveryPartnerStackParamList>();
