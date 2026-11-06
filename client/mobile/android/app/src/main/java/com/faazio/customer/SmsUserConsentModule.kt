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

  private var receiverRegistered = false

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
              activity.startActivityForResult(consentIntent, SMS_CONSENT_REQUEST)
            } catch (error: Exception) {
              emitError("consent-launch-failed")
            }
          }
          CommonStatusCodes.TIMEOUT -> {
            unregisterSmsReceiver()
            emitError("timeout")
          }
          else -> {
            unregisterSmsReceiver()
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
    unregisterSmsReceiver()
  }

  /** NativeEventEmitter probes these; both are no-ops because events go through RCTDeviceEventEmitter. */
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != SMS_CONSENT_REQUEST) return
    unregisterSmsReceiver()
    if (resultCode != Activity.RESULT_OK || data == null) {
      emitError("consent-denied")
      return
    }
    val message = data.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
    val code = message?.let { CODE_REGEX.find(it)?.value }
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
  }
}
