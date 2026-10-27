package com.faazio.customer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Ongoing location service for an online delivery partner.
 *
 * It intentionally does not hold the location itself: every [HEARTBEAT_INTERVAL_SECONDS] it wakes
 * the `FaazioDeliveryHeartbeat` headless task, which takes one coarse fix through the shared
 * geolocation module and posts it with the rider's existing bearer token. The service only keeps
 * the process/OEM scheduler alive and tells the rider (via the persistent notification) that
 * location is being used.
 */
class DeliveryTrackingService : Service() {
  private var scheduler: ScheduledExecutorService? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    startAsForeground()
    startScheduler()
    // Do not let the OS restart a location FGS from the background: a restart while the app is
    // not visible can be rejected (Android 14) without ACCESS_BACKGROUND_LOCATION. The rider
    // reopening the app while online restarts tracking.
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    scheduler?.shutdownNow()
    scheduler = null
    super.onDestroy()
  }

  private fun startAsForeground() {
    val openApp = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification: Notification =
      NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_delivery_tracking)
        .setContentTitle("Faazio Delivery Partner is online")
        .setContentText("Sharing your location so nearby orders can reach you.")
        .setContentIntent(openApp)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun startScheduler() {
    if (scheduler != null) return
    val executor = Executors.newSingleThreadScheduledExecutor()
    scheduler = executor
    executor.scheduleWithFixedDelay(
      { wakeHeartbeatTask() },
      INITIAL_DELAY_SECONDS,
      HEARTBEAT_INTERVAL_SECONDS,
      TimeUnit.SECONDS,
    )
  }

  private fun wakeHeartbeatTask() {
    try {
      // The app already owns a foreground service, so a plain service start is allowed here.
      startService(Intent(this, DeliveryHeartbeatTaskService::class.java))
    } catch (_: Exception) {
      // The next tick retries; never crash the rider app for a missed heartbeat.
    }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Delivery tracking",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps your location fresh while you are online for deliveries."
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val ACTION_START = "com.faazio.delivery.START"
    const val ACTION_STOP = "com.faazio.delivery.STOP"
    private const val CHANNEL_ID = "faazio_delivery_tracking"
    private const val NOTIFICATION_ID = 4210
    private const val INITIAL_DELAY_SECONDS = 30L
    private const val HEARTBEAT_INTERVAL_SECONDS = 120L
  }
}
