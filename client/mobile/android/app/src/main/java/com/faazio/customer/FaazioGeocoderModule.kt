package com.faazio.customer

import android.location.Geocoder
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

/**
 * Reverse geocoding via the platform Geocoder. Coordinates are resolved on
 * device and never sent to a third party.
 */
class FaazioGeocoderModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FaazioGeocoder"

  @Suppress("DEPRECATION")
  @ReactMethod
  fun reverseGeocode(latitude: Double, longitude: Double, promise: Promise) {
    Thread {
      try {
        val geocoder = Geocoder(reactApplicationContext, Locale.getDefault())
        if (!Geocoder.isPresent()) {
          promise.resolve(null)
          return@Thread
        }

        val addresses = geocoder.getFromLocation(latitude, longitude, 1)
        val address = addresses?.firstOrNull()
        if (address == null) {
          promise.resolve(null)
          return@Thread
        }

        val result = Arguments.createMap().apply {
          putString("street", address.thoroughfare ?: address.subThoroughfare)
          putString("district", address.subLocality ?: address.locality)
          putString("city", address.locality)
          putString("region", address.adminArea)
          putString("postalCode", address.postalCode)
          putString("name", address.featureName)
        }
        promise.resolve(result)
      } catch (error: Exception) {
        // Best-effort: the JS layer falls back to raw coordinates.
        promise.resolve(null)
      }
    }.start()
  }
}
