package com.faazio.customer

import android.content.Context
import android.location.Geocoder
import android.location.LocationManager
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

  /**
   * OS-level "Location" master switch. Distinct from this app's runtime grant: when it is off no
   * fix is possible at all, so JS must not treat the last known coordinate as live.
   */
  @ReactMethod
  fun isLocationServicesEnabled(promise: Promise) {
    try {
      val manager =
        reactApplicationContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
      if (manager == null) {
        promise.resolve(false)
        return
      }
      @Suppress("DEPRECATION")
      promise.resolve(manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
        manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
    } catch (error: Exception) {
      promise.resolve(false)
    }
  }

  /**
   * Forward geocoding for a saved address (the address book stores text, not coordinates), so a
   * selected saved address can become the live nearby-feed origin. Resolves null when the text
   * cannot be resolved — callers must not invent coordinates.
   */
  @Suppress("DEPRECATION")
  @ReactMethod
  fun geocodeAddress(address: String, promise: Promise) {
    Thread {
      try {
        val query = address.trim()
        if (query.isEmpty() || !Geocoder.isPresent()) {
          promise.resolve(null)
          return@Thread
        }

        val geocoder = Geocoder(reactApplicationContext, Locale.getDefault())
        val results = geocoder.getFromLocationName(query, 1)
        val first = results?.firstOrNull()
        if (first == null) {
          promise.resolve(null)
          return@Thread
        }

        promise.resolve(
          Arguments.createMap().apply {
            putDouble("latitude", first.latitude)
            putDouble("longitude", first.longitude)
          },
        )
      } catch (error: Exception) {
        promise.resolve(null)
      }
    }.start()
  }

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
