package com.faazio.customer

import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS bridge for the delivery foreground service. Only the partner bundle calls it; the customer
 * flavor registers the package but never starts the service.
 */
class DeliveryTrackingModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FaazioDeliveryTracking"

  @ReactMethod
  fun start(promise: Promise) {
    try {
      val intent = Intent(reactApplicationContext, DeliveryTrackingService::class.java)
        .setAction(DeliveryTrackingService.ACTION_START)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(reactApplicationContext, intent)
      } else {
        reactApplicationContext.startService(intent)
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("tracking_start_failed", error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      reactApplicationContext.stopService(
        Intent(reactApplicationContext, DeliveryTrackingService::class.java)
      )
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("tracking_stop_failed", error)
    }
  }
}
