// Expo Config Plugin — 修补 @react-native-voice/voice 使其兼容 AndroidX
// 等价于 GitHub CI 中的 sed patch，但在 EAS Build 中自动执行

const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

function withVoiceAndroidXFix(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const voiceBuildGradle = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        '@react-native-voice',
        'voice',
        'android',
        'build.gradle'
      )

      if (fs.existsSync(voiceBuildGradle)) {
        let content = fs.readFileSync(voiceBuildGradle, 'utf8')

        // 替换 jcenter() 为 google() + mavenCentral()
        content = content.replace(
          /mavenLocal\(\)\s*\n\s*jcenter\(\)/,
          "mavenLocal()\n        google()\n        mavenCentral()"
        )

        // 替换 com.android.support:appcompat-v7 为 AndroidX
        content = content.replace(
          /com\.android\.support:appcompat-v7:[^"]*/g,
          'androidx.appcompat:appcompat:1.6.1'
        )

        // Update compileSdk/targetSdk to modern versions
        content = content.replace(
          /def DEFAULT_COMPILE_SDK_VERSION = \d+/,
          'def DEFAULT_COMPILE_SDK_VERSION = 34'
        )
        content = content.replace(
          /def DEFAULT_TARGET_SDK_VERSION = \d+/,
          'def DEFAULT_TARGET_SDK_VERSION = 34'
        )
        content = content.replace(
          /def DEFAULT_BUILD_TOOLS_VERSION = "[^"]*"/,
          'def DEFAULT_BUILD_TOOLS_VERSION = "34.0.0"'
        )
        content = content.replace(
          /def DEFAULT_SUPPORT_LIB_VERSION = "[^"]*"/,
          'def DEFAULT_SUPPORT_LIB_VERSION = "1.6.1"'
        )

        fs.writeFileSync(voiceBuildGradle, content)
        console.log('✓ Patched @react-native-voice/voice for AndroidX compatibility')
      }

      return config
    },
  ])
}

module.exports = withVoiceAndroidXFix
