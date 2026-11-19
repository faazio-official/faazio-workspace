import { deliveryNavigationRef } from '../navigationRef';
import { createCallController } from '@/features/call/controller';
import { gateway } from '@/services/api/GatewayClient';

/**
 * Delivery-partner binding for the shared masked-calling controller. The state machine, VOIP
 * adapter, native-ring facade and background handler are shared with the customer app; only the
 * navigation handle, endpoint surface and product copy differ.
 */
const controller = createCallController({
  appName: 'Faazio Delivery Partner',
  incomingInitiatedBy: 'CUSTOMER',
  defaultPeerLabel: 'Customer',
  peerLabelForRole: () => 'Customer',
  navigation: {
    isReady: () => deliveryNavigationRef.isReady(),
    currentRouteName: () => deliveryNavigationRef.getCurrentRoute()?.name,
    navigateToActiveCall: () => {
      deliveryNavigationRef.navigate('ActiveCall');
    },
    goBack: () => deliveryNavigationRef.goBack(),
  },
  api: {
    initiate: (orderId, opts) => gateway.initiateDeliveryCall(orderId, opts),
    getActive: () => gateway.getActiveDeliveryCall(),
    get: (callId) => gateway.getDeliveryCall(callId),
    ackRinging: (callId) => gateway.ackDeliveryCallRinging(callId),
    join: (callId) => gateway.joinDeliveryCall(callId),
    reject: (callId, reason) => gateway.rejectDeliveryCall(callId, reason),
    end: (callId, reason) => gateway.endDeliveryCall(callId, reason),
    fallback: (callId) => gateway.fallbackDeliveryCall(callId),
  },
  callKeep: {
    channelId: 'faazio_delivery_calls',
    channelName: 'Delivery calls',
    notificationTitle: 'Delivery call in progress',
  },
  recoverActiveCall: true,
  micPrompt: {
    title: 'Microphone for delivery calls',
    message:
      'Faazio uses the microphone only while you are on a delivery call. You can still use the secure phone line without it.',
    negative: 'Use phone line',
  },
  bluetoothPrompt: {
    title: 'Bluetooth for delivery calls',
    message:
      'Allow Bluetooth so a paired helmet or headset can be used for delivery calls. You can decline and use the earpiece.',
  },
  messages: {
    offline: 'You are offline. Calling needs a live connection.',
    orderNotAccepted: 'Accept the delivery before calling the customer.',
    unavailable: 'Calling is not configured for this account yet.',
    notFound: 'This call is no longer available.',
    conflict: 'Finish the current call first.',
    microphoneDenied:
      'Microphone access is needed for an app call. Allow it in Settings, or use the secure phone line.',
    generic: 'Could not start the call. Please try again.',
  },
});

export const bootstrapCalling = controller.bootstrap;
export const initializeDeliveryCalling = controller.initialize;
export const flushPendingActiveCall = controller.flushPendingActiveCall;
export const startDeliveryCall = controller.start;
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

/** True while a call session is open (connecting/ringing/active/ending). */
export const isCallOpen = controller.isOpen;
