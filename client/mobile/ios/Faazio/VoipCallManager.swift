//
//  VoipCallManager.swift
//  Faazio
//
//  PushKit + CallKit owner for the iOS customer app.
//
//  Why this exists: an iOS incoming delivery call must ring through the system CallKit screen, and
//  iOS only allows that from a PushKit VoIP push reported to CallKit immediately — the OS terminates
//  an app that receives a VoIP push without reporting a call. A plain (FCM relayed) background push
//  cannot wake the device for CallKit, so the gateway sends `apns-push-type: voip` to this app's
//  VoIP token.
//
//  This file also owns the `CXProvider`. `react-native-callkeep` stays Android-only precisely so the
//  app never has two providers competing for the same call.
//

import Foundation
import AVFoundation
import CallKit
import PushKit
import React

/// The subset of the call push payload the native ring needs. The rest of the payload is handed
/// back to JS verbatim so the shared controller can drive the same state machine as Android.
struct VoipPushPayload {
  let callId: String
  let callUuid: UUID
  let orderId: String
  let peerRole: String
  let callerLabel: String
  let mode: String
  let raw: [String: Any]

  init?(userInfo: [AnyHashable: Any]) {
    guard let callId = userInfo["callId"] as? String, !callId.isEmpty else { return nil }
    guard
      let uuidString = userInfo["callUuid"] as? String,
      let uuid = UUID(uuidString: uuidString)
    else {
      // CallKit rejects a malformed UUID; reporting anyway would crash the push handler.
      return nil
    }
    self.callId = callId
    self.callUuid = uuid
    self.orderId = userInfo["orderId"] as? String ?? ""
    self.peerRole = userInfo["peerRole"] as? String ?? ""
    self.mode = userInfo["mode"] as? String ?? "VOIP"
    let label = userInfo["callerLabel"] as? String ?? ""
    self.callerLabel = label.isEmpty ? "Faazio call" : label
    // `userInfo` is keyed by `AnyHashable` (it arrives from PKPushPayload/UserDefaults), but the
    // payload handed back to JS must be `[String: Any]`. Re-key explicitly and drop NSNull values
    // (they cannot cross the RN bridge).
    var raw: [String: Any] = [:]
    for (key, value) in userInfo {
      guard let key = key as? String, !(value is NSNull) else { continue }
      raw[key] = value
    }
    self.raw = raw
  }
}

@objc(VoipCallManager)
final class VoipCallManager: NSObject, PKPushRegistryDelegate, CXProviderDelegate {

  @objc static let shared = VoipCallManager()

  private let store = UserDefaults.standard
  private var registry: PKPushRegistry?
  private var provider: CXProvider?

  /// UUIDs the app ended itself. CallKit replays our own `CXEndCallAction` through the delegate, and
  /// treating that as a user hang-up would make the JS controller end the call twice (and loop).
  private var locallyEnded = Set<UUID>()
  /// The UUID the app answered from the in-app surface, so the delegate does not re-announce it.
  private var locallyAnswered = Set<UUID>()
  /// UUIDs CallKit already accepted. A re-delivered VoIP push for the same ring must not be reported
  /// again: `reportNewIncomingCall` fails for an existing call, and that failure would make JS drop to
  /// the in-app surface while CallKit is still ringing.
  private var reportedCalls = Set<UUID>()

  /// Mirrors `VoipCallBridge.shared.hasListeners`; when false the event is only persisted so the JS
  /// side can adopt it on the next launch (answer/end before React Native finished booting).
  private var hasListeners = false

  enum Keys {
    static let voipToken = "faazio.voip.token"
    static let pendingCall = "faazio.voip.pendingCall"
    static let pendingAnswered = "faazio.voip.pendingAnswered"
    static let pendingEnded = "faazio.voip.pendingEnded"
    /// True only once CallKit actually accepted the ring. A refused report must not make JS think a
    /// native call is on screen (it would skip the in-app surface and ring nowhere).
    static let pendingDisplayed = "faazio.voip.pendingDisplayed"
  }

  // MARK: - Lifecycle

  /// Starts PushKit and builds the provider. Called once from the app delegate so a VoIP push that
  /// launches the app in the background can be reported before React Native exists.
  ///
  /// There is no call to make without the `voip` background mode and the APNs entitlement, so this
  /// is safe to run on every launch: the registry simply stays silent until a token arrives.
  @objc func start() {
    if registry == nil {
      let registry = PKPushRegistry(queue: .main)
      registry.delegate = self
      registry.desiredPushTypes = [.voIP]
      self.registry = registry
    }
    _ = callProvider()
  }

  private func callProvider() -> CXProvider {
    if let provider = provider { return provider }
    let configuration = CXProviderConfiguration(localizedName: "Faazio")
    configuration.supportsVideo = false
    configuration.maximumCallGroups = 1
    configuration.maximumCallsPerCallGroup = 1
    configuration.supportedHandleTypes = [.generic]
    let provider = CXProvider(configuration: configuration)
    provider.setDelegate(self, queue: nil)
    self.provider = provider
    return provider
  }

  // MARK: - PushKit

  func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    guard type == .voIP else { return }
    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    guard !token.isEmpty else { return }
    // Persisted so the JS side can register it after sign-in; the token itself is a device
    // credential and is never logged.
    store.set(token, forKey: Keys.voipToken)
    emit("VoipTokenUpdated", body: ["token": token])
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didInvalidatePushTokenFor type: PKPushType
  ) {
    guard type == .voIP else { return }
    store.removeObject(forKey: Keys.voipToken)
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }
    guard let call = VoipPushPayload(userInfo: payload.dictionaryPayload) else {
      // A VoIP push that is not a call is still ours (the topic is VoIP-scoped); acknowledge it so
      // the push budget is not spent re-delivering something we cannot act on.
      completion()
      return
    }
    reportIncoming(call)
    // Must be called promptly: iOS terminates an app that holds a VoIP push without reporting.
    completion()
  }

  // MARK: - Reporting to CallKit

  private func reportIncoming(_ call: VoipPushPayload) {
    persistPending(call, answered: false, ended: false, displayed: false)

    if reportedCalls.contains(call.callUuid) {
      // The provider re-delivered the ring (or the push was collapsed oddly): the CallKit call is
      // already on screen. Re-announce so JS can ack it, never report a second time.
      store.set(true, forKey: Keys.pendingDisplayed)
      emit("VoipCallDisplayed", body: [
        "callId": call.callId,
        "callUuid": call.callUuid.uuidString.lowercased(),
      ])
      return
    }

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: call.callerLabel)
    update.localizedCallerName = call.callerLabel
    update.hasVideo = false
    update.supportsHolding = false
    update.supportsDTMF = false
    update.supportsGrouping = false
    update.supportsUngrouping = false

    reportedCalls.insert(call.callUuid)
    callProvider().reportNewIncomingCall(with: call.callUuid, update: update) { [weak self] error in
      guard let self = self else { return }
      if let error = error {
        // Unentitled / already-reported / Do-Not-Disturb. Keep the payload so the JS in-app
        // surface can adopt the same call row, but never claim a native ring is on screen. Drop the
        // marker so a genuine retry can still report.
        self.reportedCalls.remove(call.callUuid)
        self.store.set(false, forKey: Keys.pendingDisplayed)
        self.emit("VoipCallFailed", body: [
          "callId": call.callId,
          "callUuid": call.callUuid.uuidString.lowercased(),
          "error": error.localizedDescription,
        ])
        return
      }
      self.store.set(true, forKey: Keys.pendingDisplayed)
      self.emit("VoipCallDisplayed", body: [
        "callId": call.callId,
        "callUuid": call.callUuid.uuidString.lowercased(),
      ])
    }
  }

  // MARK: - CXProviderDelegate

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    let uuid = action.callUUID
    let call = pendingCall()
    persistPending(call, answered: true, ended: false)
    // Fulfilling the answer action is what moves CallKit from ringing to in-call.
    action.fulfill()
    if locallyAnswered.remove(uuid) != nil { return }
    emit("VoipCallAnswered", body: answerBody(uuid, call: call))
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    let uuid = action.callUUID
    let call = pendingCall()
    persistPending(call, answered: false, ended: true)
    reportedCalls.remove(uuid)
    action.fulfill()
    // An end requested by the app itself (in-app End button) already drove the JS state machine;
    // announcing it again would double-end the session.
    if locallyEnded.remove(uuid) != nil { return }
    emit("VoipCallEnded", body: answerBody(uuid, call: call))
  }

  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    // Outgoing calls start from the app, never from Recents: refuse rather than half-open one.
    action.fail()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    // CallKit hands us an activated session; the 100ms SDK takes it from here. Without the
    // playAndRecord/voiceChat configuration the peer hears silence. Do NOT ask for the speaker or
    // A2DP: a voice call must default to the earpiece (and a headset uses the hands-free profile),
    // exactly like a carrier call.
    do {
      try audioSession.setCategory(
        .playAndRecord,
        mode: .voiceChat,
        options: [.allowBluetoothHFP]
      )
      try audioSession.setActive(true)
    } catch {
      // The 100ms SDK re-activates the session on join; a failure here is not fatal.
    }
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
  }

  func providerDidReset(_ provider: CXProvider) {
    reportedCalls.removeAll()
    clearPending()
  }

  // MARK: - JS-facing operations

  /// The pending push + whether it was answered or ended while JS was not listening.
  func state() -> [String: Any] {
    var body: [String: Any] = [
      "answered": store.bool(forKey: Keys.pendingAnswered),
      "ended": store.bool(forKey: Keys.pendingEnded),
      "displayed": store.bool(forKey: Keys.pendingDisplayed),
      "voipToken": store.string(forKey: Keys.voipToken) ?? "",
    ]
    if let call = pendingCall() { body["call"] = call.raw }
    return body
  }

  /// Ends a ringing or active call from the in-app surface. Uses a CallKit transaction so the
  /// system screen and the app agree on the call state.
  func endCall(uuidString: String) {
    guard let uuid = UUID(uuidString: uuidString) else { return }
    locallyEnded.insert(uuid)
    let action = CXEndCallAction(call: uuid)
    let transaction = CXTransaction(action: action)
    CXCallController().request(transaction) { [weak self] error in
      // A failed transaction means the call is already gone; drop the marker so a later
      // system-initiated end is still reported.
      if error != nil { self?.locallyEnded.remove(uuid) }
    }
  }

  /// Tells CallKit the user accepted from the in-app surface. Fulfilling the answer action moves
  /// the call to connected; the marker stops the delegate re-announcing an answer JS already drove.
  func answerCall(uuidString: String) {
    guard let uuid = UUID(uuidString: uuidString) else { return }
    locallyAnswered.insert(uuid)
    let action = CXAnswerCallAction(call: uuid)
    CXCallController().request(CXTransaction(action: action)) { [weak self] error in
      // A failed transaction means the call is already gone (answered elsewhere / ended).
      if error != nil { self?.locallyAnswered.remove(uuid) }
    }
  }

  /// Asks for microphone access. The iOS VOIP leg cannot record without it, so the JS controller
  /// calls this before joining a room and falls back to the masked phone line when it is denied.
  /// (The AVAudioSession API is used rather than the iOS 17 AVAudioApplication one so the file
  /// builds against every supported deployment target.)
  func requestMicrophone(_ resolve: @escaping RCTPromiseResolveBlock) {
    let session = AVAudioSession.sharedInstance()
    switch session.recordPermission {
    case .granted:
      resolve(true)
      return
    case .denied:
      resolve(false)
      return
    default:
      break
    }
    session.requestRecordPermission { granted in
      DispatchQueue.main.async { resolve(granted) }
    }
  }

  func clear() {
    clearPending()
  }

  func setHasListeners(_ listening: Bool) {
    hasListeners = listening
  }

  // MARK: - Persistence

  private func persistPending(
    _ call: VoipPushPayload?,
    answered: Bool,
    ended: Bool,
    displayed: Bool? = nil
  ) {
    if let call = call {
      store.set(call.raw, forKey: Keys.pendingCall)
    }
    store.set(answered, forKey: Keys.pendingAnswered)
    store.set(ended, forKey: Keys.pendingEnded)
    if let displayed = displayed {
      store.set(displayed, forKey: Keys.pendingDisplayed)
    }
  }

  private func clearPending() {
    store.removeObject(forKey: Keys.pendingCall)
    store.set(false, forKey: Keys.pendingAnswered)
    store.set(false, forKey: Keys.pendingEnded)
    store.set(false, forKey: Keys.pendingDisplayed)
  }

  private func pendingCall() -> VoipPushPayload? {
    guard let raw = store.dictionary(forKey: Keys.pendingCall) else { return nil }
    return VoipPushPayload(userInfo: raw)
  }

  private func answerBody(_ uuid: UUID, call: VoipPushPayload?) -> [String: Any] {
    var body: [String: Any] = ["callUuid": uuid.uuidString.lowercased()]
    if let call = call {
      body["callId"] = call.callId
      body["orderId"] = call.orderId
      body["peerRole"] = call.peerRole
    }
    return body
  }

  // MARK: - Events

  private func emit(_ name: String, body: [String: Any]) {
    guard hasListeners, let bridge = VoipCallBridge.shared else { return }
    bridge.sendEvent(withName: name, body: body)
  }
}

/// Thin React Native bridge over `VoipCallManager`. Registered from `VoipCallBridge.m` because Swift
/// cannot declare `RCT_EXTERN_MODULE` itself.
@objc(VoipCallBridge)
final class VoipCallBridge: RCTEventEmitter {
  static var shared: VoipCallBridge?

  override init() {
    super.init()
    VoipCallBridge.shared = self
  }

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    [
      "VoipCallAnswered",
      "VoipCallEnded",
      "VoipCallDisplayed",
      "VoipCallFailed",
      "VoipTokenUpdated",
    ]
  }

  override func startObserving() {
    VoipCallManager.shared.setHasListeners(true)
  }

  override func stopObserving() {
    VoipCallManager.shared.setHasListeners(false)
  }

  @objc func getState(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(VoipCallManager.shared.state())
  }

  @objc func clearState() {
    VoipCallManager.shared.clear()
  }

  @objc func endCall(_ uuidString: String) {
    VoipCallManager.shared.endCall(uuidString: uuidString)
  }

  @objc func answerCall(_ uuidString: String) {
    VoipCallManager.shared.answerCall(uuidString: uuidString)
  }

  @objc func requestMicrophone(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    VoipCallManager.shared.requestMicrophone(resolve)
  }
}
