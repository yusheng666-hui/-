# 雨声

你的声音，我在听。

## 项目结构

```
docs/          — 产品定位 / 技术架构 / 数据库 / Agent 逻辑 / UI 设计
notes/         — 学习笔记
src/           — 源代码
```

## 快速开始

### 前置要求

- Node.js >= 18
- Expo CLI: `npm install -g expo-cli` 或 `npx expo`
- Supabase 项目（数据库 + Edge Functions）
- Anthropic API Key（Claude Sonnet 4）
- Voyage AI API Key（可选，用于记忆搜索）

### 安装

```bash
cd src
npm install
```

### 启动

```bash
cd src
npx expo start
```

按 `a` 打开 Android 模拟器，`i` 打开 iOS 模拟器，`w` 打开 Web 版。

### 配置

1. 打开 App 后进入设置页
2. 填入 Supabase URL + Anon Key
3. 填入 Anthropic API Key
4. 可选：Voyage AI API Key（不填则不启用记忆搜索）

### Edge Function 部署

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录并链接项目
supabase login
supabase link --project-ref your-project-ref

# 部署聊天函数
supabase functions deploy chat

# 执行数据库迁移
supabase db push
```

## CI/CD — 自动构建 APK

每次推送到 `main` 或 `master` 分支时，GitHub Actions 自动构建 Android APK：

1. **检出代码** → **安装依赖** → **Expo prebuild** → **Gradle 构建** → **上传 APK**
2. 构建完成后，在 Actions 页面下载 `yusheng-apk` artifact
3. 安装到 Android 手机（侧载，需允许未知来源）

### 已知问题

`@react-native-voice/voice` 依赖旧版 `com.android.support:appcompat-v7`，与 AndroidX 冲突。workflow 在 `npm ci` 后自动 patch 该依赖为 `androidx.appcompat:appcompat`。如果升级该库版本，需确认 patch 是否仍然有效。

## 文档

详见 `docs/` 下的 5 份设计文档：
- `0-OVERVIEW.md` — 产品定位与核心原则
- `1-ARCHITECTURE.md` — 技术架构
- `2-DATABASE.md` — 数据库设计
- `3-AGENT-LOGIC.md` — AI Agent 逻辑
- `4-UI-UX.md` — 界面设计

## 开发说明

AI 开发者请先阅读 `AGENTS.md` 了解项目组织规则。
