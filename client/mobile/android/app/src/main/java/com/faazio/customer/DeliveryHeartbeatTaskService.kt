package com.faazio.customer

import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * One-shot headless bridge for a background heartbeat. The JS task is registered by
 * `index.delivery.js` as `FaazioDeliveryHeartbeat` and is a no-op when the session is signed out.
 */
class DeliveryHeartbeatTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: android.content.Intent?): HeadlessJsTaskConfig =
    HeadlessJsTaskConfig(
      "FaazioDeliveryHeartbeat",
      Arguments.createMap(),
      30_000,
      true,
    )
}
