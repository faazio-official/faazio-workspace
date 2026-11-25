import Foundation
import CoreLocation
import React

/**
 * Reverse geocoding via CoreLocation. Coordinates are resolved on device and
 * never sent to a third party.
 *
 * `getLocationAuthorizationStatus` exposes the current CoreLocation grant so JS
 * can tell "not asked yet" (safe to call requestAuthorization) from
 * "denied/restricted" (iOS will never show the prompt again; the app must send
 * the user to Settings). Without this split a second request after a denial
 * queues a callback that never fires, leaving the permission promise hanging.
 */
@objc(FaazioGeocoder)
class FaazioGeocoder: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(getLocationAuthorizationStatus:rejecter:)
  func getLocationAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    guard CLLocationManager.locationServicesEnabled() else {
      resolve("blocked")
      return
    }

    let status: CLAuthorizationStatus
    if #available(iOS 14.0, *) {
      status = CLLocationManager().authorizationStatus
    } else {
      status = CLLocationManager.authorizationStatus()
    }

    switch status {
    case .authorizedAlways, .authorizedWhenInUse:
      resolve("granted")
    case .denied, .restricted:
      resolve("blocked")
    case .notDetermined:
      resolve("undetermined")
    @unknown default:
      resolve("undetermined")
    }
  }

  /**
   * OS-level "Location Services" master switch. Distinct from the app's own grant: when this is
   * off no fix is possible at all, so JS must not pretend the last known coordinate is live.
   */
  @objc(isLocationServicesEnabled:rejecter:)
  func isLocationServicesEnabled(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(CLLocationManager.locationServicesEnabled())
  }

  /**
   * iOS has no "turn on Location Services" dialog an app can open — only the system Settings app
   * exposes that master switch. Report the current state so JS can direct the user to Settings
   * instead of pretending the app can flip it. On Android this shows the OS resolution dialog.
   *
   * Resolves `"enabled"` when the switch is on, `"unavailable"` when it is off (never `"cancelled"`
   * because no system dialog was shown).
   */
  @objc(requestEnableLocation:rejecter:)
  func requestEnableLocation(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(CLLocationManager.locationServicesEnabled() ? "enabled" : "unavailable")
  }

  /**
   * Forward geocoding for a saved address (the address book stores text, not coordinates), so a
   * selected saved address can become the live nearby-feed origin. Resolves `nil` when the text
   * cannot be resolved — callers must not invent coordinates.
   */
  @objc(geocodeAddress:resolver:rejecter:)
  func geocodeAddress(
    _ address: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    // Forward geocoding needs no location grant or Location Services: a manually typed address
    // must still resolve when the user has location switched off.
    let query = address.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else {
      resolve(nil)
      return
    }

    CLGeocoder().geocodeAddressString(query) { placemarks, _ in
      guard let location = placemarks?.first?.location else {
        resolve(nil)
        return
      }
      resolve([
        "latitude": location.coordinate.latitude,
        "longitude": location.coordinate.longitude,
      ])
    }
  }

  @objc(reverseGeocode:longitude:resolver:rejecter:)
  func reverseGeocode(
    _ latitude: Double,
    longitude: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let geocoder = CLGeocoder()
    let location = CLLocation(latitude: latitude, longitude: longitude)

    geocoder.reverseGeocodeLocation(location) { placemarks, _ in
      guard let place = placemarks?.first else {
        resolve(nil)
        return
      }

      let payload: [String: Any] = [
        "street": place.thoroughfare ?? place.subThoroughfare ?? NSNull(),
        // Sub-locality only. Falling back to `locality` put the CITY in the district field
        // (e.g. district "Tiruchirappalli", city "Tiruchirappalli"); the city has its own key below.
        "district": place.subLocality ?? NSNull(),
        // The revenue/administrative district coverage is keyed on. `district` above is the
        // sub-locality, which for a taluk town (e.g. Lalgudi) is not the district name.
        "adminDistrict": place.subAdministrativeArea ?? NSNull(),
        "city": place.locality ?? NSNull(),
        "region": place.administrativeArea ?? NSNull(),
        "postalCode": place.postalCode ?? NSNull(),
        "name": place.name ?? NSNull(),
      ]
      resolve(payload)
    }
  }
}
