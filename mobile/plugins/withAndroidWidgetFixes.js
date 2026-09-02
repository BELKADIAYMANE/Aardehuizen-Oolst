const { withAndroidManifest, withSettingsGradle } = require("expo/config-plugins");

function withAndroidWidgetFixes(config) {
  config = withSettingsGradle(config, (config) => {
    const marker = 'id("org.gradle.toolchains.foojay-resolver-convention")';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents = config.modResults.contents.replace(
        "plugins {",
        `plugins {\n  ${marker} version "1.0.0"`,
      );
    }
    return config;
  });

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return config;

    app.$["android:usesCleartextTraffic"] = "true";

    const receivers = app.receiver ?? [];
    for (const receiver of receivers) {
      const name = receiver.$?.["android:name"] ?? "";
      if (name.includes("widget") || name.includes("Aardehuizen")) {
        receiver.$["android:exported"] = "true";
      }
    }
    return config;
  });
}

module.exports = withAndroidWidgetFixes;
