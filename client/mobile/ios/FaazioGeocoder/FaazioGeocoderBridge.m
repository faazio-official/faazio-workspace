#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FaazioGeocoder, NSObject)

RCT_EXTERN_METHOD(getLocationAuthorizationStatus:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reverseGeocode:(double)latitude
                  longitude:(double)longitude
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
