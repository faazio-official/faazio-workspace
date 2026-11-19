package com.faazio.customer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * Android incoming-call ringing, without the telecom framework.
 *
 * A high-importance notification with a full-screen intent and Answer/Decline actions is the pattern
 * Swiggy/Zomato use: it needs no `ConnectionService`, no phone account and therefore never shows the
 * system "Phone account required" dialog. The full-screen intent is what wakes the lock screen; on
 * Android 14+ it degrades to a heads-up notification when the user has not granted the special
 * full-screen-notifications access.
 *
 * The caller's number never reaches this layer: the label is the masked peer role only.
 */
object IncomingCallNotifications {
  const val CHANNEL_ID = "faazio_incoming_calls"

  private const val RING_TIMEOUT_MS = 60_000L

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Incoming calls",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Rings for an incoming delivery call."
      enableVibration(true)
      setShowBadge(false)
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  fun notificationId(callId: String): Int = callId.hashCode() and 0x7fffffff

  /**
   * Post the ringing notification. Returns false when the OS refused it (notifications blocked), so
   * the caller can let the server fall back to the masked phone line instead of ringing silently.
   */
  fun show(
    context: Context,
    callId: String,
    callUuid: String?,
    orderId: String,
    label: String,
    payload: String?,
  ): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val manager = context.getSystemService(NotificationManager::class.java)
      if (manager?.areNotificationsEnabled() == false) return false
    }
    ensureChannel(context)

    // Body tap → receiver (park the payload for a cold start, then launch the activity).
    val openApp = PendingIntent.getBroadcast(
      context,
      notificationId(callId),
      Intent(context, IncomingCallReceiver::class.java)
        .setAction(IncomingCallReceiver.ACTION_OPEN)
        .putExtra(IncomingCallReceiver.EXTRA_CALL_ID, callId)
        .putExtra(IncomingCallReceiver.EXTRA_CALL_UUID, callUuid)
        .putExtra(IncomingCallReceiver.EXTRA_PAYLOAD, payload),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    // Full-screen intent must target an activity for the lock-screen presentation.
    val fullScreen = PendingIntent.getActivity(
      context,
      notificationId(callId) + 1,
      Intent(context, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val suffix = if (orderId.isNotEmpty()) " · #${orderId.takeLast(6)}" else ""
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_call_notification)
      .setContentTitle("Incoming call")
      .setContentText("$label$suffix")
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setTimeoutAfter(RING_TIMEOUT_MS)
      .setContentIntent(openApp)
      .setFullScreenIntent(fullScreen, true)
      .addAction(
        0,
        "Decline",
        actionIntent(context, IncomingCallReceiver.ACTION_DECLINE, callId, callUuid, payload),
      )
      .addAction(
        0,
        "Answer",
        actionIntent(context, IncomingCallReceiver.ACTION_ANSWER, callId, callUuid, payload),
      )

    return try {
      val manager = context.getSystemService(NotificationManager::class.java) ?: return false
      manager.notify(notificationId(callId), builder.build())
      true
    } catch (_: Exception) {
      // SecurityException (notifications blocked for the app) — caller falls back to PSTN.
      false
    }
  }

  fun cancel(context: Context, callId: String) {
    try {
      context.getSystemService(NotificationManager::class.java)
        ?.cancel(notificationId(callId))
    } catch (_: Exception) {
      // Already gone.
    }
  }

  private fun actionIntent(
    context: Context,
    action: String,
    callId: String,
    callUuid: String?,
    payload: String?,
  ): PendingIntent {
    val requestCode = (callId + action).hashCode()
    val intent = Intent(context, IncomingCallReceiver::class.java)
      .setAction(action)
      .putExtra(IncomingCallReceiver.EXTRA_CALL_ID, callId)
      .putExtra(IncomingCallReceiver.EXTRA_CALL_UUID, callUuid)
      .putExtra(IncomingCallReceiver.EXTRA_PAYLOAD, payload)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
