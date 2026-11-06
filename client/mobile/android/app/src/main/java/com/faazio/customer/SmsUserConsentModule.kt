package com.faazio.customer

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
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
  ActivityEventListener {

  @Volatile private var receiverRegistered = false

  /** Guards against launching a second consent sheet while one is already showing. */
  @Volatile private var consentInFlight = false

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
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
              emitError("no-activity")
              return
            }
            try {
              consentInFlight = true
              activity.startActivityForResult(consentIntent, SMS_CONSENT_REQUEST)
            } catch (error: Exception) {
              consentInFlight = false
              emitError("consent-launch-failed")
            }
          }
          CommonStatusCodes.TIMEOUT -> {
            unregisterSmsReceiver()
            consentInFlight = false
            emitError("timeout")
          }
          else -> {
            unregisterSmsReceiver()
            consentInFlight = false
            emitError("sms-retrieval-failed")
          }
        }
      }
    }

  init {
    reactApplicationContext.addActivityEventListener(this)
  }

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun startSmsUserConsent() {
    // A resend can arrive while the sheet is open; never stack a second consent UI.
    if (consentInFlight) return
    unregisterSmsReceiver()
    registerSmsReceiver()
    SmsRetriever.getClient(reactApplicationContext)
      .startSmsUserConsent(null)
      .addOnFailureListener {
        unregisterSmsReceiver()
        emitError("start-failed")
      }
  }

  @ReactMethod
  fun stopSmsUserConsent() {
    consentInFlight = false
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
    unregisterSmsReceiver()
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
  }

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
    val CODE_REGEX = Regex("\\b\\d{6}\\b")
    val OTP_KEYWORD_REGEX = Regex("(?i)(?:code|otp|pin)\\D{0,24}(\\d{6})")
  }
}
