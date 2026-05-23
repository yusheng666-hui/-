# 技术架构

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React Native + Expo SDK 54 (TypeScript) |
| 样式方案 | StyleSheet（6 套主题色） |
| 数据持久化 | AsyncStorage（全部数据本地存储） |
| 凭据存储 | expo-secure-store（API Key）；localStorage fallback（Web 端） |
| LLM | 原生 fetch → 直连（Anthropic/OpenAI 双格式） |
| 语音克隆 | 可选：OpenVoice v2（HF Spaces） |

## 架构概览

App 核心功能无后端服务，全部数据存储在手机本地。

```
UI 页面 (expo-router) → 组件层 → lib/
  ├─ chat.ts        → LLM API（Anthropic/OpenAI）
  ├─ db.ts          → AsyncStorage 本地数据库
  ├─ tts.ts         → 语音播放（四后端）
  └─ storage.ts     → SecureStore / localStorage
```

## 主题系统（6 套）

| 主题 | 背景色 | 强调色 |
|------|--------|--------|
| pure_white | #ffffff | #e8a87c |
| warm_cream | #fdf6ee | #d4a07a |
| soft_pink | #fdf0f5 | #e08aa8 |
| deep_purple（默认） | #1a1a2e | #533483 |
| warm_sunset | #1e1410 | #c97b5d |
| amoled_black | #000000 | #bb86fc |

## 发送消息流程

```
用户输入 → streamChat()
  ├─ 模式检查：chat / journal / low_power(上限2轮) / emergency
  ├─ 信号检测（正则，+3ms）
  ├─ 偏好更新（6 维置信度，+10ms）
  ├─ 构建动态 System Prompt
  │   ├─ 学习阶段 + 偏好模型
  │   ├─ 相关记忆（关键词 top 5）
  │   └─ 活跃话题 + 词汇镜像
  ├─ 调用 LLM（流式 SSE）
  │   ├─ Anthropic: /v1/messages
  │   └─ OpenAI: /v1/chat/completions
  └─ 处理流式回复
      ├─ think 工具 → 分析/策略/自评/话题/词汇/里程碑/反刍/行动/产出/结束
      ├─ save_memory → 记忆持久化
      ├─ recall_memories → 关键词检索
      └─ text → 前端打字机效果
```

## 学习闭环

信号 → 偏好置信度调整 → Prompt 构建 → LLM → 自评

| 信号 | 影响维度 |
|------|---------|
| gratitude / agreement | tone, advice_style ↑ |
| emotional_resonance | emotional_expressiveness, response_depth ↑ |
| self_disclosure | response_depth, emotional_expressiveness ↑ |
| disagreement | tone, confrontation_comfort ↓ |
| short_reply | response_depth, advice_style ↓ |
| topic_abandonment | confrontation_comfort ↓ |

## 六维偏好模型

| 维度 | 值域 | 默认 |
|------|------|------|
| tone | gentle/direct/warm/neutral | gentle |
| advice_style | reflective/practical/emotional/spiritual | reflective |
| confrontation_comfort | always_soothe/gentle_challenge/direct_honest | gentle_challenge |
| humor | none/light/moderate | light |
| response_depth | surface/moderate/deep | moderate |
| emotional_expressiveness | restrained/moderate/expressive | moderate |

## 学习三阶段

| 阶段 | 条件 | 行为 |
|------|------|------|
| cold_start | 0-3 次 | 默认人格 + 偏好探测 |
| calibration | 4-20 次 | 风格试探 |
| deep_tuning | 21+ 次 | 稳定执行 + 主动洞察 |

## 四种模式

| 模式 | LLM | 学习 | 界面 |
|------|-----|------|------|
| chat | 完整 think | 启用 | 完整 |
| journal | 不调用 | 仅本地保存 | 输入框 + 已记录提示 |
| low_power | 2 轮上限，极简回复 | 关闭 | 显示剩余轮次 |
| emergency | 不分析，只承接 | 关闭 | 语音优先 + 大按钮 |

## Think 工具字段

- analysis / strategy（必填）
- assess_previous_response
- detected_topic
- new_vocabulary
- growth_milestone
- suggested_action
- structured_output
- wrap_up
- rumination_detected

## 滑动窗口摘要

消息超 20 条 → 对前 10 条生成摘要 → 替换为单条摘要，保留即时上下文。

## Prompt 成本压缩

- 低置信度（< 0.3）维度不注入，节省 ~300 tokens
- 低电量模式跳过记忆+偏好+学习阶段，节省 ~60%

## TTS 语音系统

统一接口支持四后端：expo-speech（默认）、OpenAI TTS、Web Speech、Voice Clone（OpenVoice v2）。
语音偏好六维进化（语速/音调/音量/表现力/停顿感/温暖度），行为信号驱动置信度。

## 本地数据（AsyncStorage）

| 键 | 存储 |
|-----|------|
| @db:conversations | 对话列表 |
| @db:messages:{id} | 消息列表 |
| @db:profile | 用户画像 |
| @db:preferences | 6 维偏好 |
| @db:memories | 记忆库 |
| @db:topics | 话题追踪 |
| @db:custom_actions | 自定义动作 |
| @db:conversation_summaries | 对话摘要 |
| @db:action_logs | 行动反馈 |
| @db:generated_outputs | AI 产出 |
| @db:mood_checkins | 情绪签到 |
| @db:voice_profile | 语音配置 |
| @db:streak | 连续签到 |
| @db:gratitude | 三件好事 |

## 组件列表

chat-bubble / mode-selector / learning-badge / mood-checkin / mood-picker / mood-calendar /
grounding-exercise / voice-recorder / error-boundary / onboarding-guide /
emergency-floating-btn / three-good-things

## CI/CD 构建流水线

GitHub Actions 自动构建 Android APK，workflow 位于 `.github/workflows/build-android.yml`。

### 构建步骤

1. `npm ci` — 安装依赖
2. `sed` patch — 将 `@react-native-voice/voice` 的 `com.android.support:appcompat-v7` 替换为 `androidx.appcompat:appcompat`
3. `npx expo prebuild --platform android --no-install` — 生成原生 Android 项目
4. `./gradlew assembleDebug` — 构建 debug APK
5. `actions/upload-artifact` — 上传 APK 到构建产物

### 触发方式

- 推送到 `main` 或 `master` 分支自动触发
- 也可在 GitHub Actions 页面手动触发（workflow_dispatch）

### 产物

- artifact 名称：`yusheng-apk`
- 路径：`src/android/app/build/outputs/apk/debug/*.apk`
- 下载后侧载到 Android 手机即可安装

### 构建问题

详见 [`docs/BUILD.md`](BUILD.md)。

## 页面路由

index（首页）/ chat/[id]（聊天）/ settings（设置）/ conversations（历史）/ memories（记忆）/ insights（洞察）/ outputs（产出）
