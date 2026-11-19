package com.faazio.customer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Arguments

/**
 * Answer/Decline buttons on the incoming-call notification (and the "open app" tap).
 *
 * Each tap cancels the ringing notification, parks the action in [IncomingCallState] for a cold
 * start, and emits it when JS is already running. No call state is mutated here: the JS controller
 * is the single owner of the call state machine and the server row.
 */
class IncomingCallReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: return
    val callUuid = intent.getStringExtra(EXTRA_CALL_UUID)
    val payload = intent.getStringExtra(EXTRA_PAYLOAD)

    if (action == ACTION_OPEN) {
      // The full-screen intent / body tap: bring the app up and let JS adopt the ringing call. The
      // payload is parked only when the runtime is gone; a live JS navigates from the emitted event.
      IncomingCallNotifications.cancel(context, callId)
      if (IncomingCallState.isRuntimeActive()) {
        IncomingCallState.emit(
          EVENT_NAME,
          Arguments.createMap().apply {
            putString("action", "open")
            putString("callId", callId)
          },
        )
      } else {
        IncomingCallState.setPending("open", callId, buildPayload(callUuid, payload))
      }
      launchApp(context)
      return
    }

    if (action != ACTION_ANSWER && action != ACTION_DECLINE) return
    IncomingCallNotifications.cancel(context, callId)

    val normalized = if (action == ACTION_ANSWER) "answer" else "decline"
    val map = Arguments.createMap().apply {
      putString("action", normalized)
      putString("callId", callId)
      if (callUuid != null) putString("callUuid", callUuid)
      if (payload != null) putString("payload", payload)
    }

    // Live runtime: hand it over immediately. Dead/cold runtime: park it for `getPendingAction()`
    // on the next boot. Parking in both cases would replay the action after it was already handled.
    if (IncomingCallState.isRuntimeActive()) {
      IncomingCallState.emit(EVENT_NAME, map)
    } else {
      IncomingCallState.setPending(normalized, callId, buildPayload(callUuid, payload))
    }

    if (normalized == "answer") launchApp(context)
  }

  /** A cold-start answer needs the call id and uuid too, so they travel in the parked payload. */
  private fun buildPayload(callUuid: String?, payload: String?): String? {
    if (callUuid == null) return payload
    return try {
      val base = if (payload.isNullOrBlank()) {
        org.json.JSONObject()
      } else {
        org.json.JSONObject(payload)
      }
      base.put("callUuid", callUuid)
      base.toString()
    } catch (_: Exception) {
      payload
    }
  }

  private fun launchApp(context: Context) {
    try {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent(context, MainActivity::class.java)
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      context.startActivity(launch)
    } catch (_: Exception) {
      // The notification already delivered the action; a blocked launch must not crash.
    }
  }

  companion object {
    const val ACTION_ANSWER = "com.faazio.call.ANSWER"
    const val ACTION_DECLINE = "com.faazio.call.DECLINE"
    const val ACTION_OPEN = "com.faazio.call.OPEN"

    const val EXTRA_CALL_ID = "callId"
    const val EXTRA_CALL_UUID = "callUuid"
    const val EXTRA_PAYLOAD = "payload"

    const val EVENT_NAME = "FaazioIncomingCallAction"
  }
}
