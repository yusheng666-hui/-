# 自我进化能力 — 实现方案

## 当前状态

本方案中的"每轮学习循环"核心机制已在 `src/lib/chat.ts` 中实现，所有数据存储在本地 AsyncStorage，不依赖任何后端服务。

---

## 已实现的闭环（`streamChat` 函数）

```
用户消息 → ①信号检测（signal-detector.ts）
         → ②偏好更新（preference-updater.ts）
         → ③构建动态 Prompt（prompt-builder.ts）
         → ④调用 LLM
         → ⑤流式回复 + think 工具自评
```

### ① 信号检测（`src/supabase/functions/chat/signal-detector.ts`）

纯正则规则引擎，在 LLM 调用前完成：

| 信号类型 | 触发文本 | 含义 |
|---------|---------|------|
| gratitude | "谢谢"/"有用"/"帮到我了" | 感谢 |
| agreement | "对"/"是的"/"没错" | 认同 |
| emotional_resonance | "说到我心坎了"/"太懂了" | 情感共鸣 |
| self_disclosure | 字符数 > 50 且含个人经历 | 自我暴露 |
| disagreement | "不是"/"不对"/"你不懂" | 反驳 |
| topic_abandonment | "算了"/"不说了" | 放弃话题 |
| short_reply | AI 回复 > 100 字，用户 < 10 字 | 短回复 |

### ② 偏好更新（`preference-updater.ts`）

更新六维偏好模型：

- 积极信号 → 对应维度置信度 +0.1（上限 0.95）
- 消极信号 → 对应维度置信度 -0.15，对面值 +0.05
- 置信度低于 0.3 的维度不注入 System Prompt

### ③ Prompt 构建（`prompt-builder.ts`）

根据学习阶段、偏好模型、记忆库动态拼接 System Prompt。

### ④ LLM 调用 + ⑤ 流式回复

支持 Anthropic Messages API 和 OpenAI Chat Completions API 双格式，流式 SSE 解析。

---

## 六维偏好模型

| 维度 | 可取值 | 默认值 |
|------|--------|--------|
| tone | gentle / direct / warm / neutral | gentle |
| advice_style | reflective / practical / emotional / spiritual | reflective |
| confrontation_comfort | always_soothe / gentle_challenge / direct_honest | gentle_challenge |
| humor | none / light / moderate | light |
| response_depth | surface / moderate / deep | moderate |
| emotional_expressiveness | restrained / moderate / expressive | moderate |

各维度存储在 `@db:preferences`（AsyncStorage），每条记录含 `{ dimension, value, confidence }`。

---

## 学习三阶段

| 阶段 | 触发条件 | 行为 |
|------|---------|------|
| cold_start | 0~3 次对话 | 默认人格，在对话中自然穿插偏好探测问题 |
| calibration | 3~20 次对话 | 对低置信度维度做风格试探 |
| deep_tuning | 20+ 次对话 | 高置信度偏好稳定执行，开启主动洞察 |

阶段通过 `profile.interaction_count` 自动计算，`profile.learning_stage` 持久化。

---

## think 工具增强

LLM 在 `think` 调用中可包含以下可选字段：

- `assess_previous_response` — 自评上轮回复质量（quality_score, was_effective, user_engagement）
- `detected_topic` — 话题检测（is_new_topic, topic_keywords, emotion_state）
- `new_vocabulary` — 检测到用户的新情绪词汇
- `growth_milestone` — 识别到的成长时刻（self_discovery / coping_success / positive_shift / pattern_break / new_perspective）
- `suggested_action` — 推荐微行动（description, emotion_context）
- `structured_output` — 生成产出（draft_reply / decision_card / journal / letter / emotion_card）
- `wrap_up` — 对话结束检测（summary, topic）
- `rumination_detected` — 反刍思维检测（detected, pattern），触发 UI 提示

所有字段由 `src/lib/chat.ts` 中的工具循环处理并持久化到 AsyncStorage。

---

## 实施顺序（已完成）

| 步骤 | 状态 | 文件 |
|------|------|------|
| 信号检测引擎 | ✅ | `signal-detector.ts` |
| 偏好更新逻辑 | ✅ | `preference-updater.ts` |
| 动态 Prompt 构建 | ✅ | `prompt-builder.ts` |
| 工具循环增强 | ✅ | `chat.ts` |
| 学习阶段逻辑 | ✅ | `chat.ts` |
| 偏好置信度面板 | ✅ | `settings.tsx` |
| 学习阶段徽章 | ✅ | `learning-badge.tsx` |

## 本次新增（Phase 3 深度共生 — 体验层）

| 步骤 | 状态 | 文件 | 说明 |
|------|------|------|------|
| Action Logs 持久化 | ✅ | `db.ts` / `chat.ts` | AI 推荐微行动后持久化反馈跟踪 |
| Structured Output | ✅ | `db.ts` / `chat.ts` | 回信、决策卡、日记等生成产物的自动保存 |
| 对话摘要滑动窗口 | ✅ | `chat.ts` / `db.ts` | 消息超 20 条时对前 10 条生成摘要 |
| 产出管理页 | ✅ | `outputs.tsx` | 展示 GeneratedOutput，支持保存/导出/删除 |
| AI 主动开场 | ✅ | `chat/[id].tsx` | 距上次 >6 小时显示主题开场或问候 |
| 沉默许可提示 | ✅ | `chat/[id].tsx` | AI 回复后底部显示 |
| 记忆库搜索 | ✅ | `memories.tsx` | 记忆页关键词搜索 |
| 数据导出 | ✅ | `settings.tsx` | JSON 一键导出全部数据 |

## 本次新增：体验层功能

| 步骤 | 状态 | 文件 | 说明 |
|------|------|------|------|
| 新手引导页 | ✅ | `onboarding-guide.tsx` | 三段式 Modal 引导，首次启动自动弹出 |
| 情绪急救浮动按钮 | ✅ | `emergency-floating-btn.tsx` | 全局 🫂 按钮，跳转急救模式，支持开关 |
| 反刍识别提示 | ✅ | `chat.ts` / `chat/[id].tsx` | think 工具检测反刍，UI 显示提示条 |
| 往事回顾提示 | ✅ | `chat.ts` / `chat/[id].tsx` | recall_memories 触发 UI 淡提示条 |
| AI 模式发现 | ✅ | `insights.tsx` | 从 Topics 派生模式卡片，可查看关联记忆 |
| 本周简报 | ✅ | `insights.tsx` | 统计卡片：对话/成长/情绪/话题 |
| 快捷回复 | ✅ | `chat/[id].tsx` | AI 回复后显示上下文快捷回复芯片 |
| 话题引导卡片 | ✅ | `chat/[id].tsx` | 空状态 10 话题随机 + "不知道说什么" 按钮 |
| 日志模式占位符 | ✅ | `chat/[id].tsx` | 输入框根据模式切换提示文字 |
| 低电量轮次显示 | ✅ | `chat/[id].tsx` | 顶部显示"剩余 N 轮" |
| TTS 离开清理 | ✅ | `chat/[id].tsx` | 页面卸载时自动停止语音 |
| 三件好事 | ✅ | `three-good-things.tsx` | 积极心理学练习，主页可展开 |
| 连续签到持久化 | ✅ | `db.ts` / `mood-checkin.tsx` | 签到天数持久化存储 |
| 情绪日历增强 | ✅ | `mood-calendar.tsx` | 月进度显示 + 6 种情绪完整图例 |

## 本次新增：AI 语音回复系统

| 步骤 | 状态 | 文件 | 说明 |
|------|------|------|------|
| TTS Service Layer | ✅ | `src/lib/tts.ts` | 统一接口，支持 expo-speech / OpenAI TTS / Web Speech 三后端 |
| 文本预处理管线 | ✅ | `src/lib/tts-processor.ts` | 去 Markdown、去 AI 味句式、emoji→语调、自然节奏、情绪标签 |
| 语音偏好进化 | ✅ | `src/lib/voice-profile.ts` | 六维进化 + 情绪→语音映射 + 行为信号检测 + 置信度系统 |
| UI 集成 | ✅ | `chat/[id].tsx` / `settings.tsx` / `chat-bubble.tsx` | 播放按钮、自动朗读、语速/音调/音量滑块、开关控制 |
| 依赖 | ✅ | `expo-speech` | 跨平台 TTS 库 |
