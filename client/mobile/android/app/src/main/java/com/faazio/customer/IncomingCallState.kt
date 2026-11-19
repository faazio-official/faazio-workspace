package com.faazio.customer

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Process-wide hand-off for an incoming-call notification action.
 *
 * The Answer/Decline buttons are `PendingIntent`s owned by [IncomingCallReceiver]. A tap can land
 * while React Native is not running (swiped-away app), so the action and its payload are parked here
 * first: the JS layer reads them once on boot through `getPendingAction()` and then clears them. A
 * tap that lands while JS *is* running is also emitted as an event, so the live controller reacts
 * immediately instead of waiting for a relaunch.
 */
object IncomingCallState {
  /** The running React context, when JS is alive. Never logged. */
  @Volatile
  private var reactContext: ReactApplicationContext? = null

  @Volatile
  private var pendingAction: String? = null

  @Volatile
  private var pendingCallId: String? = null

  @Volatile
  private var pendingPayload: String? = null

  fun attach(context: ReactApplicationContext) {
    reactContext = context
  }

  fun detach(context: ReactApplicationContext) {
    if (reactContext === context) reactContext = null
  }

  fun setPending(action: String, callId: String, payload: String?) {
    pendingAction = action
    pendingCallId = callId
    pendingPayload = payload
  }

  /** True when a live React runtime can consume an action event right now. */
  fun isRuntimeActive(): Boolean = reactContext?.hasActiveReactInstance() == true

  fun takePending(): WritableMap? {
    val action = pendingAction ?: return null
    val callId = pendingCallId ?: return null
    val payload = pendingPayload
    pendingAction = null
    pendingCallId = null
    pendingPayload = null
    return Arguments.createMap().apply {
      putString("action", action)
      putString("callId", callId)
      if (payload != null) putString("payload", payload)
    }
  }

  fun clearPending() {
    pendingAction = null
    pendingCallId = null
    pendingPayload = null
  }

  /** Emit to JS when a runtime is present; a dead runtime simply has no listener to notify. */
  fun emit(event: String, payload: WritableMap) {
    val context = reactContext ?: return
    try {
      if (!context.hasActiveReactInstance()) return
      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, payload)
    } catch (_: Exception) {
      // A dying runtime must never crash the notification action.
    }
  }
}
