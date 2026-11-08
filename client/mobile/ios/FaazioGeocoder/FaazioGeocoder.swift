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
        "district": place.subLocality ?? place.locality ?? NSNull(),
        "city": place.locality ?? NSNull(),
        "region": place.administrativeArea ?? NSNull(),
        "postalCode": place.postalCode ?? NSNull(),
        "name": place.name ?? NSNull(),
      ]
      resolve(payload)
    }
  }
}
