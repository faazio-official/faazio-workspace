package com.faazio.customer

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    DefaultReactHost.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here.
          add(FaazioGeocoderPackage())
          if (BuildConfig.FLAVOR == "delivery") add(DeliveryTrackingPackage())
        },
      // Debug shells load JS from Metro; release shells use the embedded bundle. The delivery
      // flavor points Metro at its own entry so customer code is never requested/bundled.
      jsMainModulePath = if (BuildConfig.FLAVOR == "delivery") "index.delivery" else "index",
      useDevSupport = BuildConfig.DEBUG,
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
