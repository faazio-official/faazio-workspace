package com.faazio.customer

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.SystemClock
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

/**
 * Android SMS User Consent: Play Services intercepts the SMS and shows a system consent sheet
 * ("Allow Faazio to read the code?"). No RECEIVE_SMS/READ_SMS permission is requested; the
 * dynamically registered receiver is protected by Play Services' SEND permission and unregistered
 * as soon as a consent result or timeout arrives.
 *
 * The module only ever hands JS a 6-digit code. It never logs the SMS body, sender or code.
 */
class SmsUserConsentModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  ActivityEventListener,
  LifecycleEventListener {

  @Volatile private var receiverRegistered = false

  /** Guards against launching a second consent sheet while one is already showing. */
  @Volatile private var consentInFlight = false

  /** When the current consent sheet was launched, used to recover a dropped activity result. */
  @Volatile private var consentStartedAt = 0L

  /** True between `onHostResume` and `onHostPause` — the consent sheet may only launch while resumed. */
  @Volatile private var hostResumed = false

  /**
   * A consent intent whose SMS arrived while the app was backgrounded (the reCAPTCHA browser is
   * open, so the phone-auth send has the app in the background). Android blocks activities started
   * from a background app, and launching it then made the consent sheet come from a dead state or
   * bounce to Play services/Play Store. Hold it and show it on the next `onHostResume` instead.
   */
  private var pendingConsentIntent: Intent? = null

  private val smsReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val extras = intent.extras ?: return
        val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status
        when (status?.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            unregisterSmsReceiver()
            @Suppress("DEPRECATION")
            val consentIntent = extras.getParcelable<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT)
            if (consentIntent == null) {
              emitError("no-consent-intent")
              return
            }
            // The consent intent stays valid for ~5 minutes, so showing it after the user returns
            // to the app (and foregrounds it) is still in time.
            pendingConsentIntent = consentIntent
            launchPendingConsent()
          }
          CommonStatusCodes.TIMEOUT -> {
            unregisterSmsReceiver()
            consentInFlight = false
            consentStartedAt = 0L
            pendingConsentIntent = null
            emitError("timeout")
          }
          else -> {
            unregisterSmsReceiver()
            consentInFlight = false
            consentStartedAt = 0L
            pendingConsentIntent = null
            emitError("sms-retrieval-failed")
          }
        }
      }
    }

  init {
    reactApplicationContext.addActivityEventListener(this)
    reactApplicationContext.addLifecycleEventListener(this)
    // The module is usually created after the host has already resumed, so seed the flag from the
    // current activity; later onHostResume/onHostPause keep it accurate.
    hostResumed = reactApplicationContext.hasCurrentActivity()
  }

  override fun getName(): String = MODULE_NAME

  /**
   * Launch the held consent intent only from a resumed activity with a live window. If the app is
   * backgrounded (system browser showing the reCAPTCHA) or the activity is tearing down, keep it
   * until `onHostResume` so the sheet is never requested from a dead/backgrounded task.
   */
  private fun launchPendingConsent() {
    val consentIntent = pendingConsentIntent ?: return
    if (!hostResumed) return
    val activity = reactApplicationContext.currentActivity
    if (activity == null || activity.isFinishing || activity.isDestroyed) return
    pendingConsentIntent = null
    try {
      consentInFlight = true
      consentStartedAt = SystemClock.elapsedRealtime()
      activity.startActivityForResult(consentIntent, SMS_CONSENT_REQUEST)
    } catch (error: Exception) {
      consentInFlight = false
      consentStartedAt = 0L
      emitError("consent-launch-failed")
    }
  }

  override fun onHostResume() {
    hostResumed = true
    launchPendingConsent()
  }

  override fun onHostPause() {
    hostResumed = false
  }

  override fun onHostDestroy() {
    hostResumed = false
    pendingConsentIntent = null
  }

  @Synchronized
  @ReactMethod
  fun startSmsUserConsent() {
    // A resend can arrive while the sheet is open; never stack a second consent UI. Recover if the
    // activity result was lost (e.g. the activity was recreated), so consent is never stuck forever.
    if (consentInFlight) {
      if (SystemClock.elapsedRealtime() - consentStartedAt < CONSENT_TIMEOUT_MS) return
      consentInFlight = false
    }
    unregisterSmsReceiver()
    registerSmsReceiver()
    SmsRetriever.getClient(reactApplicationContext)
      .startSmsUserConsent(null)
      .addOnFailureListener {
        unregisterSmsReceiver()
        consentInFlight = false
        emitError("start-failed")
      }
  }

  @Synchronized
  @ReactMethod
  fun stopSmsUserConsent() {
    consentInFlight = false
    consentStartedAt = 0L
    pendingConsentIntent = null
    unregisterSmsReceiver()
  }

  /** NativeEventEmitter probes these; both are no-ops because events go through RCTDeviceEventEmitter. */
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != SMS_CONSENT_REQUEST) return
    consentInFlight = false
    consentStartedAt = 0L
    unregisterSmsReceiver()
    if (resultCode != Activity.RESULT_OK || data == null) {
      emitError("consent-denied")
      return
    }
    val message = data.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
    val code = message?.let { extractCode(it) }
    if (code == null) {
      emitError("no-code")
      return
    }
    if (!reactApplicationContext.hasActiveReactInstance()) return
    val payload = Arguments.createMap().apply { putString("code", code) }
    reactApplicationContext.emitDeviceEvent(EVENT_NAME, payload)
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    consentInFlight = false
    consentStartedAt = 0L
    pendingConsentIntent = null
    hostResumed = false
    unregisterSmsReceiver()
    reactApplicationContext.removeActivityEventListener(this)
    reactApplicationContext.removeLifecycleEventListener(this)
    super.invalidate()
  }

  @Synchronized
  private fun registerSmsReceiver() {
    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactApplicationContext.registerReceiver(
        smsReceiver,
        filter,
        SmsRetriever.SEND_PERMISSION,
        null,
        Context.RECEIVER_EXPORTED,
      )
    } else {
      @Suppress("DEPRECATION")
      reactApplicationContext.registerReceiver(
        smsReceiver,
        filter,
        SmsRetriever.SEND_PERMISSION,
        null,
      )
    }
    receiverRegistered = true
  }

  @Synchronized
  private fun unregisterSmsReceiver() {
    if (!receiverRegistered) return
    receiverRegistered = false
    try {
      reactApplicationContext.unregisterReceiver(smsReceiver)
    } catch (error: IllegalArgumentException) {
      // Already gone (e.g. the activity was destroyed) — nothing to clean up.
    }
  }

  /**
   * Prefer a 6-digit run adjacent to an OTP keyword ("code", "OTP", "PIN") so an order id,
   * amount or timestamp earlier in the message cannot be mistaken for the code. Fall back to the
   * first standalone 6-digit run for messages that do not use those words.
   */
  private fun extractCode(message: String): String? {
    OTP_KEYWORD_REGEX.find(message)?.groupValues?.getOrNull(1)?.let { return it }
    return CODE_REGEX.find(message)?.value
  }

  private fun emitError(reason: String) {
    if (!reactApplicationContext.hasActiveReactInstance()) return
    val payload = Arguments.createMap().apply { putString("error", reason) }
    reactApplicationContext.emitDeviceEvent(EVENT_NAME, payload)
  }

  private companion object {
    const val MODULE_NAME = "FaazioSmsUserConsent"
    const val EVENT_NAME = "FaazioSmsUserConsent"
    const val SMS_CONSENT_REQUEST = 0xFAA2
    const val CONSENT_TIMEOUT_MS = 5 * 60 * 1000L

    // Whole-token keyword match (so "shipping"/"pincode" never look like "pin"), and a 6-digit run
    // that is not part of a longer number (so a 7-digit order id is not truncated into a code).
    val CODE_REGEX = Regex("(?<!\\d)\\d{6}(?!\\d)")
    val OTP_KEYWORD_REGEX =
      Regex("(?i)\\b(?:code|otp|pin)\\b\\D{0,24}(?<!\\d)(\\d{6})(?!\\d)")
  }
}
