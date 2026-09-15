/**
 * with-release-signing.js — Expo config plugin
 *
 * Wires the Android `release` build type to the release keystore and forces
 * BOTH v1 (JAR) + v2 APK signature schemes, deterministically, after every
 * `expo prebuild --clean` regenerates the gitignored `android/` dir.
 *
 * Why v1 is required: with AGP 8.x and targetSdkVersion >= 30 (this project
 * uses 36) AGP defaults `v1SigningEnabled` to `false`, producing a v2-only
 * APK. Some devices/install paths reject v2-only APKs with "App not installed
 * as package appears to be invalid". Signing with v1+v2 is the recommended
 * practice for APK distribution.
 *
 * Credentials are read from `keystore/keystore.properties` (restored in CI by
 * `scripts/restore-keystore.sh`, or present locally). The keystore itself and
 * the properties file are gitignored / sourced from secrets — never committed.
 */
const { withAppBuildGradle } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function readProps(projectRoot) {
  const propsPath = path.join(projectRoot, "keystore", "keystore.properties");
  if (!fs.existsSync(propsPath)) {
    throw new Error(
      `[with-release-signing] ${propsPath} not found. ` +
        "Run scripts/restore-keystore.sh first (or create keystore/keystore.properties locally)."
    );
  }
  const props = {};
  for (const line of fs.readFileSync(propsPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) props[m[1]] = m[2];
  }
  return props;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const propsPath = path.join(projectRoot, "keystore", "keystore.properties");

    // Fail soft: without keystore.properties (normal dev prebuild, no release
    // signing), leave the generated build.gradle untouched so `expo run:android`
    // / `npm run android` keep working. CI restores the keystore first, so
    // release builds always get wired here.
    if (!fs.existsSync(propsPath)) {
      console.warn(
        "[with-release-signing] keystore/keystore.properties not found — skipping release signing (dev build)."
      );
      return config;
    }

    const props = readProps(projectRoot);

    const required = ["STORE_FILE", "KEYSTORE_PASS", "KEY_ALIAS", "ALIAS_PASS"];
    for (const key of required) {
      if (!props[key]) {
        throw new Error(`[with-release-signing] keystore.properties missing ${key}`);
      }
    }

    // Resolve STORE_FILE relative to the android/ dir (keystore.properties holds
    // a path relative to android/app/, e.g. ../../keystore/faazio-release.keystore).
    const storeFile = path.join(
      config.modRequest.platformProjectRoot,
      "app",
      props.STORE_FILE
    );
    if (!fs.existsSync(storeFile)) {
      throw new Error(`[with-release-signing] keystore not found at ${storeFile}`);
    }

    const escape = (v) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const storeAbs = storeFile.replace(/\\/g, "/");

    const releaseBlock =
      `\n        release {\n` +
      `            storeFile file('${storeAbs}')\n` +
      `            storePassword "${escape(props.KEYSTORE_PASS)}"\n` +
      `            keyAlias "${escape(props.KEY_ALIAS)}"\n` +
      `            keyPassword "${escape(props.ALIAS_PASS)}"\n` +
      `            v1SigningEnabled true\n` +
      `            v2SigningEnabled true\n` +
      `        }\n`;

    let src = config.modResults.contents;

    // 1. Add a `release` signingConfig (if not already present).
    if (!/signingConfigs\.release/.test(src)) {
      // Find the closing brace of the `signingConfigs { ... }` block by
      // counting braces from its opening.
      const scStart = src.indexOf("signingConfigs {");
      if (scStart === -1) {
        throw new Error("[with-release-signing] could not locate signingConfigs block");
      }
      let depth = 0;
      let blockEnd = -1;
      for (let i = scStart; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) {
            blockEnd = i;
            break;
          }
        }
      }
      if (blockEnd === -1) {
        throw new Error("[with-release-signing] could not parse signingConfigs block");
      }
      src = src.slice(0, blockEnd + 1) + releaseBlock + src.slice(blockEnd + 1);
    }

    // 2. Point the `release` build type at the release signingConfig, leaving
    //    the `debug` build type untouched. Scope to within the `buildTypes {`
    //    block so we don't accidentally rewrite the `release` signingConfig.
    const btStart = src.indexOf("buildTypes {");
    if (btStart === -1) {
      throw new Error("[with-release-signing] could not locate buildTypes block");
    }
    const btTail = src.slice(btStart);
    // Find the `release {` inside buildTypes, then the first signingConfig line.
    const relM = btTail.match(/\brelease \{/);
    if (!relM) {
      throw new Error("[with-release-signing] could not locate release buildType");
    }
    const relHead = relM.index + relM[0].length;
    const before = btTail.slice(0, relHead);
    let after = btTail.slice(relHead);
    const swapped = after.replace(
      /signingConfig signingConfigs\.debug/,
      "signingConfig signingConfigs.release"
    );
    if (swapped === after) {
      throw new Error("[with-release-signing] could not swap release signingConfig");
    }
    after = swapped;
    src = src.slice(0, btStart) + before + after;

    config.modResults.contents = src;
    return config;
  });
};
