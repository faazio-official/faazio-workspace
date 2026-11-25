package com.faazio.customer

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.location.Geocoder
import android.location.LocationManager
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import java.util.Locale

/**
 * Reverse geocoding via the platform Geocoder plus the OS location master-switch helpers.
 * Coordinates are resolved on device and never sent to a third party.
 */
class FaazioGeocoderModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  /** The JS promise awaiting the "turn on location" system dialog, if any. */
  private var pendingEnableLocation: Promise? = null

  init {
    reactApplicationContext.addActivityEventListener(this)
  }

  override fun getName(): String = "FaazioGeocoder"

  private fun locationServicesEnabled(): Boolean {
    val manager =
      reactApplicationContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
      ?: return false
    @Suppress("DEPRECATION")
    return manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
      manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
  }

  /**
   * OS-level "Location" master switch. Distinct from this app's runtime grant: when it is off no
   * fix is possible at all, so JS must not treat the last known coordinate as live.
   */
  @ReactMethod
  fun isLocationServicesEnabled(promise: Promise) {
    try {
      promise.resolve(locationServicesEnabled())
    } catch (error: Exception) {
      promise.resolve(false)
    }
  }

  /**
   * When the OS Location master switch is off, show Android's own Google-Maps-style "Turn on
   * location" dialog (Play Services resolution, not a permission prompt). Resolves:
   * - `"enabled"` — location is on afterwards;
   * - `"cancelled"` — the user dismissed the prompt/screen and it is still off;
   * - `"unavailable"` — no Activity, so no prompt could be launched.
   *
   * When Play Services cannot show its dialog (e.g. OEM builds such as Huawei/EMUI that block the
   * resolution activity) this falls back to opening the system Location screen directly, so the
   * user enables location in one tap and the pending promise resolves automatically on return.
   *
   * The app's runtime permission is requested separately by JS first, so by the time this runs the
   * grant is settled and Play Services is never permission-ambiguous.
   */
  @ReactMethod
  fun requestEnableLocation(promise: Promise) {
    if (locationServicesEnabled()) {
      promise.resolve("enabled")
      return
    }
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve("unavailable")
      return
    }
    // Ignore a duplicate tap while a system prompt/screen is already up.
    if (pendingEnableLocation != null) {
      promise.resolve("cancelled")
      return
    }

    pendingEnableLocation = promise

    val settingsRequest =
      LocationSettingsRequest.Builder()
        .addLocationRequest(
          LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L).build(),
        )
        .setAlwaysShow(true)
        .build()

    try {
      LocationServices.getSettingsClient(reactApplicationContext)
        .checkLocationSettings(settingsRequest)
        .addOnSuccessListener {
          // Play Services can believe the settings are satisfied while the platform providers are
          // still off (seen on some OEM builds) — trust the actual provider state.
          if (locationServicesEnabled()) {
            resolveEnableLocation("enabled")
          } else {
            openLocationSettingsScreen(activity)
          }
        }
        .addOnFailureListener { error ->
          if (error is ResolvableApiException) {
            try {
              // The system "Turn on location" dialog, one tap, exactly like Google Maps.
              error.startResolutionForResult(activity, ENABLE_LOCATION_REQUEST)
              return@addOnFailureListener
            } catch (ignored: Exception) {
              // Fall through to the direct system Location screen.
            }
          }
          openLocationSettingsScreen(activity)
        }
    } catch (error: Exception) {
      openLocationSettingsScreen(activity)
    }
  }

  /** Fallback when Play Services cannot show its dialog: open the OS Location screen. */
  private fun openLocationSettingsScreen(activity: Activity) {
    try {
      activity.startActivityForResult(
        Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS),
        OPEN_LOCATION_SETTINGS_REQUEST,
      )
    } catch (ignored: Exception) {
      resolveEnableLocation(if (locationServicesEnabled()) "enabled" else "unavailable")
    }
  }

  private fun resolveEnableLocation(status: String) {
    val promise = pendingEnableLocation ?: return
    pendingEnableLocation = null
    promise.resolve(status)
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    if (requestCode != ENABLE_LOCATION_REQUEST && requestCode != OPEN_LOCATION_SETTINGS_REQUEST) {
      return
    }
    // The dialog/screen's result code is not authoritative; read the provider state directly.
    resolveEnableLocation(if (locationServicesEnabled()) "enabled" else "cancelled")
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    resolveEnableLocation("cancelled")
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
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
        // Coverage names are matched against the English district master, so ask the platform
        // geocoder for English names regardless of the device UI language (a Tamil-locale phone
        // otherwise returns தமிழ்நாடு / திருச்சிராப்பள்ளி and never matches the master).
        val geocoder = Geocoder(reactApplicationContext, Locale.ENGLISH)
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
          // Sub-locality only. Falling back to `locality` put the CITY in the district field
          // (e.g. district "Tiruchirappalli", city "Tiruchirappalli"); the city has its own key below.
          putString("district", address.subLocality)
          // The revenue/administrative district coverage is keyed on. `district` above is the
          // sub-locality, which for a taluk town (e.g. Lalgudi) is not the district name.
          putString("adminDistrict", address.subAdminArea)
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

  private companion object {
    const val ENABLE_LOCATION_REQUEST = 0x4A21
    const val OPEN_LOCATION_SETTINGS_REQUEST = 0x4A22
  }
}
