//
//  VoipCallBridge.m
//  Faazio
//
//  Exposes `VoipCallManager` (Swift) to React Native. Swift cannot declare `RCT_EXTERN_MODULE`
//  itself, so the module is registered here and forwards to the Swift implementation.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(VoipCallBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(getState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearState)

RCT_EXTERN_METHOD(endCall:(NSString *)uuidString)

RCT_EXTERN_METHOD(answerCall:(NSString *)uuidString)

RCT_EXTERN_METHOD(requestMicrophone:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
