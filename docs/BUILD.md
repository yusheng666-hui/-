# 构建指南 — 打包 APK

## 概述

项目使用 GitHub Actions 自动构建 Android APK。workflow 文件：`.github/workflows/build-android.yml`。

## 触发构建

- **自动触发**：推送到 `main` 或 `master` 分支
- **手动触发**：在 GitHub Actions 页面点击 `Run workflow`

## 构建步骤

```
checkout → setup Node.js → setup Java 17 → npm ci
→ patch @react-native-voice/voice (AndroidX)
→ npx expo prebuild --platform android --no-install
→ ./gradlew assembleDebug
→ upload yusheng-apk artifact
```

## 下载与安装

1. 打开 https://github.com/yusheng666-hui/-/actions
2. 点最新的绿色构建
3. 拉到 Artifacts → 下载 `yusheng-apk`
4. 解压得到 `.apk` 文件
5. 传到手机安装（设置中允许未知来源）

## 构建问题排查

### 1. AndroidX / Support 库冲突

**错误**：
```
attribute appComponentFactory value=(androidx.core.app.CoreComponentFactory)
also present in [com.android.support:support-compat:28.0.0]
```

**原因**：`@react-native-voice/voice` 的 `android/build.gradle` 中引用 `com.android.support:appcompat-v7:${supportVersion}`。

**修复**：workflow 中自动执行 sed patch：
```bash
sed -i 's/com\.android\.support:appcompat-v7:[^"]*/androidx.appcompat:appcompat:1.6.1/' \
  node_modules/@react-native-voice/voice/android/build.gradle
```

### 2. 小组件 AndroidManifest 标签名错误

**错误**：
```
unexpected element <receivers> found in <manifest><application>
```

**原因**：`plugins/withWidget.js` 中使用 `mainApplication.receivers = []`，xml2js 序列化时数组 key 变成 XML 标签名 `<receivers>`（复数），但 Android 要求 `<receiver>`（单数）。

**修复**：在 `withWidget.js` 中改为 `mainApplication.receiver`。

### 3. 小组件资源文件找不到

**错误**：
```
resource xml/mood_widget_info not found
```

**原因**：插件中路径计算错误。`__dirname` 指向 `src/plugins/`，`path.join(__dirname, '..', '..', 'widgets/')` 解析到项目根目录而非 `src/widgets/`。

**修复**：改为 `path.join(__dirname, '..', 'widgets/')`。

### 4. 小组件 description 属性不兼容

**错误**：
```
'查看今日心情和连续签到天数' is incompatible with attribute description (attr) reference
```

**原因**：`android:description` 属性需要 `@string/...` 资源引用，不支持字面量字符串。

**修复**：从 `mood_widget_info.xml` 中移除该属性（非必填），或添加 `res/values/strings.xml` 资源文件。

### 5. expo run:android 需要真机

**错误**：
```
No Android connected device found
```

**原因**：`expo run:android` 会尝试在设备上安装应用。

**修复**：使用 `expo prebuild` + `gradle assembleDebug` 分开执行，不依赖设备。

## 本地构建（不推荐）

需要本地安装 JDK 17+、Android SDK。在 `src/` 目录下执行：

```bash
npm install
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleDebug
```

APK 生成在 `android/app/build/outputs/apk/debug/`。

> 注意：本地构建需要下载 Gradle、Android SDK 等依赖，首次构建较慢。建议使用 GitHub Actions。

## ### 6. index.android.bundle 缺失 / Unable to load script

**错误**：安装 APK 后打开闪退，显示 `Unable to load script. Make sure you're running Metro or that your bundle 'index.android.bundle' is packaged correctly for release.`

**原因**：`gradlew assembleDebug` 不会自动生成 JS bundle，需要先手动打包。

**修复**：workflow 中在 `expo prebuild` 之后、`assembleDebug` 之前加入 bundle 步骤：
```yaml
- name: Bundle JS for Android
  working-directory: src
  run: |
    mkdir -p android/app/src/main/assets
    npx react-native bundle \
      --platform android \
      --dev false \
      --entry-file index.js \
      --bundle-output android/app/src/main/assets/index.android.bundle \
      --assets-dest android/app/src/main/res
```

**依赖要求**：
- `npx react-native bundle` 需要 `@react-native-community/cli`
- Expo 项目还需要 `@expo/metro-config`（提供 Expo 特定的 Metro 配置）
- 项目根目录需要 `metro.config.js`（使用 `@expo/metro-config` 的 `getDefaultConfig`）
- 需要 `src/index.js` 作为入口文件（内容：`import 'expo-router/entry'`）

已在 `src/package.json` 的 `devDependencies` 中添加了上述依赖。

## 涉及文件

| 文件 | 作用 |
|------|------|
| `.github/workflows/build-android.yml` | CI/CD workflow |
| `plugins/withWidget.js` | Expo 配置插件，修改 AndroidManifest |
| `widgets/android/mood_widget_info.xml` | Android 小组件配置 |
| `widgets/android/MoodWidgetProvider.kt` | Android 小组件逻辑 |
| `app.json` | Expo 配置，含 plugins 列表 |
