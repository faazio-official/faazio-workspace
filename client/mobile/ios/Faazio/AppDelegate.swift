import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Firebase Phone Auth / FCM require the default Firebase app to be configured before React
    // Native starts. RNFB does not auto-configure it on iOS: without this, `getApps()` is empty,
    // `firebaseAuthConfigured()` is false, and the login screen silently takes its dev-only
    // placeholder path (fake token -> gateway 401 -> session expiry -> back to Login loop).
    // Reads the bundled GoogleService-Info.plist for the active product configuration.
    if FirebaseApp.app() == nil {
      FirebaseApp.configure()
    }

    // Register for APNs without prompting. Firebase Phone Auth uses a silent push for app
    // verification (no reCAPTCHA browser); that path needs an APNs token, which only exists
    // after this call. The notification-permission prompt is still handled later by Messaging.
    application.registerForRemoteNotifications()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // Linking API
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // FirebaseAuth method-swizzles this delegate to consume its `app-<GOOGLE_APP_ID>` reCAPTCHA
    // callback; the generic linking manager handles every other URL.
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Each product has its own entry; other products' modules are never served/bundled for it.
    let bundleRoot: String
    switch Bundle.main.bundleIdentifier {
    case "com.faazio.deliverypartner":
      bundleRoot = "index.delivery"
    case "com.faazio.sellerpartner":
      bundleRoot = "index.seller"
    default:
      bundleRoot = "index"
    }
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: bundleRoot)
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
