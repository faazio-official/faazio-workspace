package com.faazio.customer

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(null)
    applyOrientationPolicy(resources.configuration.smallestScreenWidthDp)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyOrientationPolicy(newConfig.smallestScreenWidthDp)
  }

  /**
   * Large-screen policy, shared by all three Android products (customer / delivery / seller use
   * this single shell): stay portrait on handsets, leave tablets and foldables (>= 600dp smallest
   * width) free to rotate and resize. Mirrors iOS, where the customer Info.plist locks the iPhone
   * to portrait but lets the iPad rotate.
   *
   * The manifest deliberately sets no `android:screenOrientation` — that attribute is exactly what
   * Google Play flags as a large-screen restriction — so the OS default (free) stands and portrait
   * is pinned at runtime only below the 600dp threshold, keeping the Play pre-launch large-screen
   * check green. Calling this from `onConfigurationChanged` keeps fold/unfold (which the activity
   * handles itself via `configChanges`) in sync without an activity recreation.
   */
  private fun applyOrientationPolicy(smallestWidthDp: Int) {
    val desired = if (smallestWidthDp >= 600) {
      ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    } else {
      ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }
    if (requestedOrientation != desired) {
      requestedOrientation = desired
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
  }

  /**
   * Align the back button behavior with Android S where moving root activities to background
   * instead of finishing activities.
   */
  override fun invokeDefaultOnBackPressed() {
    if (android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
