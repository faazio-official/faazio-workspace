import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Root navigation container ref. Lets non-screen code (e.g. the root
 * ErrorBoundary's "Go to Home") reset navigation without a screen prop.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
