package com.faazio.customer

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    DefaultReactHost.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here.
          add(FaazioGeocoderPackage())
          if (BuildConfig.FLAVOR == "delivery") add(DeliveryTrackingPackage())
        },
      // Debug shells load JS from Metro; release shells use the embedded bundle. Each partner
      // flavor points Metro at its own entry so customer code is never requested/bundled.
      jsMainModulePath = when (BuildConfig.FLAVOR) {
        "delivery" -> "index.delivery"
        "seller" -> "index.seller"
        else -> "index"
      },
      useDevSupport = BuildConfig.DEBUG,
    )
  }

  override fun onCreate() {
    super.onCreate()
    createSellerOrderChannel()
    loadReactNative(this)
  }

  /** Seller builds: a heads-up channel with the bundled order beep for FCM notifications. */
  private fun createSellerOrderChannel() {
    if (BuildConfig.FLAVOR != "seller") return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      "seller_orders",
      "New orders",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "New seller orders awaiting accept or reject"
      enableVibration(true)
      setSound(
        Uri.parse("android.resource://$packageName/raw/order_beep"),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
    }
    manager.createNotificationChannel(channel)
  }
}
