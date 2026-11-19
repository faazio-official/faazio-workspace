package com.faazio.customer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service that keeps an answered VOIP call's microphone alive.
 *
 * Android 14+ only grants microphone access to a foreground service that declares and starts with
 * `FOREGROUND_SERVICE_TYPE_MICROPHONE`. It is started when a call becomes active and stopped on
 * teardown, so the app never holds the microphone outside a call. The audio itself is owned by the
 * 100ms SDK — this service only holds the OS grant.
 */
class CallAudioService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopForegroundCompat()
      stopSelf()
      return START_NOT_STICKY
    }
    startAsForeground()
    // Not sticky: a restarted service has no live call to hold the microphone for.
    return START_NOT_STICKY
  }

  private fun startAsForeground() {
    ensureChannel()
    val openApp = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification: Notification =
      NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_call_notification)
        .setContentTitle("Call in progress")
        .setContentText("Faazio is using the microphone for your call.")
        .setContentIntent(openApp)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Ongoing call",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Shown while a delivery call is connected."
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val ACTION_START = "com.faazio.call.AUDIO_START"
    const val ACTION_STOP = "com.faazio.call.AUDIO_STOP"
    private const val CHANNEL_ID = "faazio_call_audio"
    private const val NOTIFICATION_ID = 4211

    fun start(context: Context) {
      try {
        val intent = Intent(context, CallAudioService::class.java).setAction(ACTION_START)
        ContextCompat.startForegroundService(context, intent)
      } catch (_: Exception) {
        // A background-start restriction leaves the call audio to the SDK's own session.
      }
    }

    fun stop(context: Context) {
      try {
        context.stopService(Intent(context, CallAudioService::class.java))
      } catch (_: Exception) {
        // Already gone.
      }
    }
  }
}
