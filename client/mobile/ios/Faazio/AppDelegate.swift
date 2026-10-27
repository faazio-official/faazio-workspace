import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
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
