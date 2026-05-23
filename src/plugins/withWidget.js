// Expo Config Plugin — 小组件原生配置
// 在 expo prebuild 后自动配置 iOS Widget Extension 和 Android AppWidget

const { withXcodeProject, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins')
const path = require('path')
const fs = require('fs')

function withIOSWidget(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults
    const targetName = 'MoodWidgetExtension'
    const appGroup = 'group.com.emotional.rescue'

    // 检查是否已有 target
    const existingTarget = xcodeProject.pbxTargetByName(targetName)
    if (existingTarget) return config

    // 添加 App Group Capability
    const target = xcodeProject.findTarget({ name: config.modRequest.projectName })
    if (target) {
      xcodeProject.addCapability(target.uuid, {
        bundleIdentifier: config.modRequest.projectName,
        capabilities: {
          'com.apple.security.application-groups': [appGroup],
        },
      })
    }

    // 复制 Widget 源文件到原生目录
    const widgetSrcDir = path.join(config.modRequest.platformProjectRoot, targetName)
    if (!fs.existsSync(widgetSrcDir)) {
      fs.mkdirSync(widgetSrcDir, { recursive: true })
    }

    const widgetFiles = ['WidgetExtension.swift', 'WidgetBundle.swift']
    for (const file of widgetFiles) {
      const srcPath = path.join(__dirname, '..', '..', 'widgets', 'ios', file)
      const destPath = path.join(widgetSrcDir, file)
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath)
        xcodeProject.addSourceFile(destPath, { target: target.uuid })
      }
    }

    const plistSrc = path.join(__dirname, '..', '..', 'widgets', 'ios', 'Info.plist')
    const plistDest = path.join(widgetSrcDir, 'Info.plist')
    if (fs.existsSync(plistSrc)) {
      fs.copyFileSync(plistSrc, plistDest)
      xcodeProject.addFile(plistDest, target.uuid)
    }

    return config
  })
}

function withAndroidWidget(config) {
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults
    const mainApplication = androidManifest.manifest.application?.[0]

    // Add tools namespace if not present
    if (!androidManifest.manifest.$) androidManifest.manifest.$ = {}
    const attrs = androidManifest.manifest.$
    if (!attrs['xmlns:tools']) {
      attrs['xmlns:tools'] = 'http://schemas.android.com/tools'
    }

    if (mainApplication) {
      // Fix AndroidX / Support library conflict
      if (!mainApplication.$) mainApplication.$ = {}
      mainApplication.$['tools:replace'] = 'android:appComponentFactory'

      if (!mainApplication.receivers) mainApplication.receivers = []
      mainApplication.receivers.push({
        $: {
          'android:name': '.MoodWidgetProvider',
          'android:exported': 'true',
          'android:label': '心情签到',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
        }],
        'meta-data': [{
          $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/mood_widget_info' },
        }],
      })
    }
    return config
  })

  // 复制 Android widget 源文件
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const nativeDir = config.modRequest.platformProjectRoot
      const packagePath = 'com/emotional/rescue'

      // Java source
      const srcDir = path.join(nativeDir, 'app', 'src', 'main', 'java', packagePath)
      if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true })
      const kotlinSrc = path.join(__dirname, '..', '..', 'widgets', 'android', 'MoodWidgetProvider.kt')
      if (fs.existsSync(kotlinSrc)) {
        fs.copyFileSync(kotlinSrc, path.join(srcDir, 'MoodWidgetProvider.kt'))
      }

      // Layout XML
      const layoutDir = path.join(nativeDir, 'app', 'src', 'main', 'res', 'layout')
      if (!fs.existsSync(layoutDir)) fs.mkdirSync(layoutDir, { recursive: true })
      const layoutSrc = path.join(__dirname, '..', '..', 'widgets', 'android', 'mood_widget_layout.xml')
      if (fs.existsSync(layoutSrc)) {
        fs.copyFileSync(layoutSrc, path.join(layoutDir, 'mood_widget_layout.xml'))
      }

      // XML resources
      const xmlDir = path.join(nativeDir, 'app', 'src', 'main', 'res', 'xml')
      if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true })
      const infoSrc = path.join(__dirname, '..', '..', 'widgets', 'android', 'mood_widget_info.xml')
      if (fs.existsSync(infoSrc)) {
        fs.copyFileSync(infoSrc, path.join(xmlDir, 'mood_widget_info.xml'))
      }

      return config
    },
  ])

  return config
}

module.exports = function withWidget(config) {
  config = withIOSWidget(config)
  config = withAndroidWidget(config)
  return config
}
