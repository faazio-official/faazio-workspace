package com.faazio.customer

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * JS bridge for Android incoming-call ringing and call audio.
 *
 * Ringing is a full-screen-intent notification, not a telecom `ConnectionService`, so no phone
 * account is ever registered and the system never shows the "Phone account required" dialog. iOS
 * does not use this module at all — PushKit + CallKit own ringing there.
 */
class IncomingCallModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    IncomingCallState.attach(reactContext)
  }

  override fun getName(): String = MODULE_NAME

  /** Post (or refresh) the ringing notification. Resolves false when notifications are blocked. */
  @ReactMethod
  fun showIncomingCall(data: ReadableMap, promise: Promise) {
    try {
      val callId = data.getString("callId")?.trim().orEmpty()
      if (callId.isEmpty()) {
        promise.resolve(false)
        return
      }
      val label = data.getString("label")?.trim().orEmpty().ifEmpty { "Incoming call" }
      val orderId = data.getString("orderId")?.trim().orEmpty()
      val callUuid = data.getString("callUuid")?.trim()?.ifEmpty { null }
      val payload = data.getString("payload")
      promise.resolve(
        IncomingCallNotifications.show(
          reactApplicationContext,
          callId,
          callUuid,
          orderId,
          label,
          payload,
        ),
      )
    } catch (error: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun dismissIncomingCall(callId: String, promise: Promise) {
    IncomingCallNotifications.cancel(reactApplicationContext, callId)
    promise.resolve(true)
  }

  /** Keep the microphone grant alive for an answered call (Android 14+ requirement). */
  @ReactMethod
  fun startCallAudio(promise: Promise) {
    CallAudioService.start(reactApplicationContext)
    promise.resolve(true)
  }

  @ReactMethod
  fun stopCallAudio(promise: Promise) {
    CallAudioService.stop(reactApplicationContext)
    promise.resolve(true)
  }

  /**
   * The Answer/Decline tap that happened before JS could handle it (cold start from a killed app).
   * Returned once: the payload is cleared so a relaunch cannot replay an old action.
   */
  @ReactMethod
  fun getPendingAction(promise: Promise) {
    promise.resolve(IncomingCallState.takePending())
  }

  @ReactMethod
  fun clearPendingAction(promise: Promise) {
    IncomingCallState.clearPending()
    promise.resolve(true)
  }

  /** NativeEventEmitter probes; events go through RCTDeviceEventEmitter. */
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  override fun invalidate() {
    IncomingCallState.detach(reactApplicationContext)
    super.invalidate()
  }

  companion object {
    const val MODULE_NAME = "FaazioIncomingCall"
    const val EVENT_NAME = IncomingCallReceiver.EVENT_NAME

    /** Touch the channel early so the very first ring is high-importance, not a silent default. */
    fun prepare(context: android.content.Context) {
      IncomingCallNotifications.ensureChannel(context)
    }
  }
}
