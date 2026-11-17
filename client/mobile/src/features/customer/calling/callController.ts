import { navigationRef } from '@/navigation/navigationRef';
import { createCallController } from '@/features/call/controller';

/**
 * Customer-app binding for the shared masked-calling controller. The rider app uses the same state
 * machine, VOIP adapter, CallKeep surface and background handler; only navigation and copy differ.
 */
const controller = createCallController({
  appName: 'Faazio',
  incomingInitiatedBy: 'RIDER',
  defaultPeerLabel: 'Delivery Partner',
  peerLabelForRole: (role) =>
    role === 'CUSTOMER' ? 'Customer' : 'Delivery Partner',
  navigation: {
    isReady: () => navigationRef.isReady(),
    currentRouteName: () => navigationRef.getCurrentRoute()?.name,
    navigateToActiveCall: () => {
      navigationRef.navigate('ActiveCall');
    },
    goBack: () => navigationRef.goBack(),
  },
  callKeep: {
    channelId: 'faazio_customer_calls',
    channelName: 'Delivery calls',
    notificationTitle: 'Delivery call in progress',
  },
  // `GET /delivery/calls/active` is rider-scoped; a customer token cannot resolve its own row.
  recoverActiveCall: false,
  micPrompt: {
    title: 'Microphone for delivery calls',
    message:
      'Faazio uses the microphone only while you are on a delivery call. You can still use the secure phone line without it.',
    negative: 'Use phone line',
  },
  bluetoothPrompt: {
    title: 'Bluetooth for delivery calls',
    message:
      'Allow Bluetooth so a paired headset can be used for delivery calls. You can decline and use the earpiece.',
  },
  messages: {
    offline: 'You are offline. Calling needs a live connection.',
    orderNotAccepted: 'This order is not ready for a call yet.',
    unavailable: 'Calling is not configured for this account yet.',
    notFound: 'This call is no longer available.',
    conflict: 'Finish the current call first.',
    microphoneDenied:
      'Microphone access is needed for an app call. Allow it in Settings, or use the secure phone line.',
    generic: 'Could not start the call. Please try again.',
  },
});

export const initializeCustomerCalling = controller.initialize;
export const flushPendingActiveCall = controller.flushPendingActiveCall;
export const startCustomerCall = controller.start;
export const handleIncomingCall = controller.handleIncomingCall;
export const acceptIncomingCall = controller.accept;
export const declineIncomingCall = controller.decline;
export const endActiveCall = controller.end;
export const handleNativeEnd = controller.handleNativeEnd;
export const toggleMute = controller.toggleMute;
export const toggleSpeaker = controller.toggleSpeaker;
export const routeToBluetooth = controller.routeToBluetooth;
export const switchCallToPstn = controller.switchToPstn;
export const dismissCall = controller.dismiss;
export const shutdownCalling = controller.shutdown;
export const clearCall = controller.clear;
export const currentCallId = controller.currentCallId;
export const isCallOpen = controller.isOpen;
