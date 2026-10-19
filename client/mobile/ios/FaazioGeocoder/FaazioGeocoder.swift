import Foundation
import CoreLocation
import React

/**
 * Reverse geocoding via CoreLocation. Coordinates are resolved on device and
 * never sent to a third party.
 */
@objc(FaazioGeocoder)
class FaazioGeocoder: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
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

      resolve([
        "street": place.thoroughfare ?? place.subThoroughfare ?? NSNull(),
        "district": place.subLocality ?? place.locality ?? NSNull(),
        "city": place.locality ?? NSNull(),
        "region": place.administrativeArea ?? NSNull(),
        "postalCode": place.postalCode ?? NSNull(),
        "name": place.name ?? NSNull(),
      ])
    }
  }
}
