# Bug 报告 — 白屏闪退问题

> 最后更新：2026-05-24
> 涉及版本：Expo SDK 54 / React Native 0.81.5

---

## 一、问题概述

**现象**：Android 端打开 App 后白屏，1-2 秒内闪退，无任何错误提示。

**影响范围**：所有 Android 设备，EAS Build 和 GitHub CI 构建均受影响。

**触发场景**：首次安装后冷启动。

---

## 二、排错过程

### 2.1 尝试过的无效方案

| 尝试 | 结果 |
|------|------|
| 切换 JS 引擎（Hermes → JSC）| 仍然闪退 |
| 关闭新架构 (`newArchEnabled: false`) | 仍然闪退 |
| 精简插件列表 | 仍然闪退 |
| 裸 RN 构建（`expo prebuild` + manual Gradle）| 构建失败 |
| EAS Build 各种配置组合 | 构建失败 |

### 2.2 关键突破

找到历史提交 `b96d17c`（"Fix UI issues"）在 GitHub CI 上构建成功且可正常运行。对比发现后续修改引入了问题。

---

## 三、根因分析

### 3.1 核心原因：SecureStore this 绑定错误

**文件**：`src/lib/storage.ts`

**问题代码**：
```ts
// 错误写法 —— this 上下文丢失
getItemNative = SecureStore.getItemAsync
setItemNative = SecureStore.setItemAsync
```

直接赋值 `SecureStore.getItemAsync` 会丢失函数内部的 `this` 绑定，导致调用时抛出异常，引发 Native 层崩溃。

**修复**：
```ts
// 正确写法 —— 箭头函数保留 this
getItemNative = (key: string) => SecureStore.getItemAsync(key)
setItemNative = (key: string, value: string) => SecureStore.setItemAsync(key, value)
```

### 3.2 次要原因

1. **`@react-native-voice/voice` 兼容性**：该模块使用了已停止服务的 `jcenter()` 仓库和旧的 `com.android.support` 依赖，在 EAS Build 中会导致 Gradle 构建失败。需要：
   - GitHub CI：sed 手动替换 build.gradle
   - EAS Build：使用自定义 Expo Config Plugin (`withVoiceAndroidX.js`) 自动修补

2. **appComponentFactory 冲突**：`newArchEnabled: true` 需要 `androidx.core.app.CoreComponentFactory`，与其他依赖可能冲突。GitHub CI 中有手动修复步骤。

---

## 四、最终修复方案

### 4.1 恢复基准版本

回退到 `b96d17c`，然后逐个添加必要修改：

1. SecureStore this 绑定修复
2. `expo-router/entry` 作为 main 入口
3. 正确的 Expo SDK 54 依赖版本

### 4.2 关键文件修复清单

| 文件 | 修改内容 |
|------|---------|
| `src/lib/storage.ts` | SecureStore 箭头函数包装 |
| `src/package.json` | `"main": "expo-router/entry"` |
| `src/app.json` | `newArchEnabled: true`, `edgeToEdgeEnabled: true` |
| `src/plugins/withVoiceAndroidX.js` | 新增，EAS 自动修补 voice 模块 |
| `.github/workflows/build-android.yml` | voice AndroidX patch + manifest fix |
| `src/app/_layout.tsx` | TTS stop on unmount, notification init |

### 4.3 构建方式对比

| 方式 | 状态 | 备注 |
|------|------|------|
| GitHub Actions CI | 正常 | 手动 sed 修补 voice + manifest |
| EAS Build | 正常（修复后） | 使用 withVoiceAndroidX config plugin |

---

## 五、经验教训

1. **不要直接赋值模块方法**：`this.fn = module.method` 可能丢失 this 绑定，使用箭头函数包装
2. **第三方原生模块需审计**：`@react-native-voice/voice` 使用 jcenter（已关闭），需要预构建补丁
3. **保留可工作的基准提交**：`b96d17c` 是明确可用的版本，用于二分法定位问题
4. **EAS Build ≠ GitHub CI**：EAS 不走 CI 工作流，需要 Config Plugin 代替 sed 命令
