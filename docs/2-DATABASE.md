# 数据库设计

存储方案：**AsyncStorage**（React Native 异步键值存储）。所有数据存储在手机本地，无远程数据库依赖。

## 设计原则

1. **全部本地**：零远程数据库，所有数据存于 AsyncStorage（或 Web 端的 localStorage 兼容层）
2. **Key-Value 结构**：每个数据集使用一个独立 Key 存储 JSON 序列化后的完整数组
3. **API Key 隔离**：凭据存储在 `expo-secure-store`（原生端）/ `localStorage`（Web 端），与应用数据完全分离
4. **免迁移**：无 Schema 版本管理，启动时数据格式自动适配

## 存储 Keys 总览

| Key | 用途 | 类型 |
|-----|------|------|
| `@db:profile` | 用户配置 | `Profile` |
| `@db:preferences` | 六维偏好模型 | `Preference[]` |
| `@db:conversations` | 对话列表 | `Conversation[]` |
| `@db:messages:{convId}` | 某对话的全部消息 | `Message[]` |
| `@db:memories` | 灵魂记忆库 | `Memory[]` |
| `@db:topics` | 话题追踪 | `Topic[]` |
| `@db:custom_actions` | 自定义动作库 | `CustomAction[]` |
| `@db:action_logs` | 行动反馈日志 | `ActionLog[]` |
| `@db:generated_outputs` | AI 生成内容 | `GeneratedOutput[]` |
| `@db:mood_checkins` | 情绪签到 | `MoodCheckin[]` |
| `@db:voice_profile` | 语音设置 | `VoiceProfile` |
| `@db:conversation_summaries` | 对话摘要 | `ConversationSummary[]` |
| `@db:streak` | 连续签到天数 | `{ count: number }` |
| `@db:gratitude` | 三件好事记录 | `GratitudeEntry[]` |

### 凭据存储（独立于 AsyncStorage）

| Key | 用途 | 存储位置 |
|-----|------|---------|
| `anthropic_api_key` | LLM API Key | SecureStore / localStorage |
| `api_type` | API 类型：`'anthropic'` / `'openai'` | SecureStore / localStorage |
| `api_base_url` | API 地址 | SecureStore / localStorage |
| `api_model` | 模型名称 | SecureStore / localStorage |
| `privacy_mode` | 隐私模式开关 | SecureStore / localStorage |

> SecureStore 用于原生设备（iOS/Android），Web 端回退到 `localStorage`。

---

## 数据结构

### Profile（用户配置）

```typescript
type Profile = {
  current_personality: string    // 'tree_hole' | 'frenemy' | 'elder' | 'battle_buddy'
  personality_prompt: string     // 人格底色的 system prompt 文本
  learning_stage: string         // 'cold_start' | 'calibration' | 'deep_tuning'
  interaction_count: number      // 累计对话次数
  vocabulary_map: Record<string, string>  // 词汇镜像：用户词汇 → 标准情绪标签
  show_thinking: boolean           // 是否显示思考气泡
  onboarding_completed: boolean    // 新手引导是否完成
  show_emergency_button: boolean   // 是否显示急救浮动按钮
  last_assessment?: string         // 上轮回复自评摘要
  today_summary?: string           // 今日对话小结
}
```

存储 Key：`@db:profile`（单条记录，非数组）

默认值：
```json
{
  "current_personality": "tree_hole",
  "personality_prompt": "",
  "learning_stage": "cold_start",
  "interaction_count": 0,
  "vocabulary_map": {},
  "show_thinking": true,
  "onboarding_completed": false,
  "show_emergency_button": true
}
```

**vocabulary_map 示例**：
```json
{
  "糟心": "焦虑",
  "emo": "低落",
  "绷不住了": "崩溃",
  "麻了": "麻木"
}
```

AI 在对话中发现用户使用新的情绪词汇时，通过 think 工具的 `new_vocabulary` 字段返回，lib/chat.ts 处理后更新此字段。

---

### Preference（多维偏好模型）

```typescript
type Preference = {
  dimension: string   // 维度名
  value: string       // 当前推断值
  confidence: number  // 置信度 0~1
}
```

存储 Key：`@db:preferences`（数组，每个维度一条记录）

**六个维度**：

| 维度 | 可取值 | 说明 |
|------|--------|------|
| `tone` | gentle / direct / warm / neutral | 语气风格 |
| `advice_style` | reflective / practical / emotional / spiritual | 建议方式 |
| `confrontation_comfort` | always_soothe / gentle_challenge / direct_honest | 对直言的接受度 |
| `humor` | none / light / moderate | 幽默程度 |
| `response_depth` | surface / moderate / deep | 分析深度 |
| `emotional_expressiveness` | restrained / moderate / expressive | AI 情感表达程度 |

**置信度含义**：
- `> 0.8`：视为确定规则，AI 严格遵守
- `0.5 ~ 0.8`：主要倾向，保留弹性
- `< 0.5`：低置信度，AI 继续试探

**初始值**：各维度置信度 0.5，默认 value 为 `neutral` / `reflective` / `gentle_challenge` / `light` / `moderate` / `moderate`

**更新逻辑**（在 lib/chat.ts 中实现）：
- 检测到积极信号（gratitude / agreement / emotional_resonance / self_disclosure）→ 对应维度置信度 +0.1（上限 0.95）
- 检测到消极信号（disagreement / short_reply / topic_abandonment）→ 对应维度置信度 -0.15，试探对侧值 +0.05

---

### Conversation（对话列表）

```typescript
type Conversation = {
  id: string
  mode: string        // 'chat' | 'journal' | 'low_power' | 'emergency'
  current_round: number
  created_at: string   // ISO 8601
  last_message?: string // 最后一条消息的预览文本
}
```

存储 Key：`@db:conversations`（数组）

**模式说明**：
- `chat`：正常交流
- `journal`：日志模式，不调用 LLM，仅保存记录
- `low_power`：低电量模式，3 轮对话上限
- `emergency`：急救模式，不调用 think 工具

---

### Message（消息记录）

```typescript
type Message = {
  id: string
  role: 'user' | 'assistant' | 'thought'
  content: string
  quality_score?: number  // AI 自评分数 1-10，仅 assistant 消息可用
  created_at: string      // ISO 8601
}
```

存储 Key：`@db:messages:{convId}`（数组，每条消息对应一个对话 ID）

**role 说明**：
- `user`：用户消息
- `assistant`：AI 回复（可能带有 quality_score 自评）
- `thought`：AI 的思考过程（think 工具输出），前端渲染为 🧠 气泡

---

### Memory（灵魂记忆库）

```typescript
type Memory = {
  id: string
  content: string
  category: string         // 分类
  emotion_tag?: string     // 关联情绪标签
  weight: number           // 重要度权重
  created_at: string       // ISO 8601
}
```

存储 Key：`@db:memories`（数组）

**category 分类**：

| 分类 | 标签 | 说明 |
|------|------|------|
| `trigger` | 触发源 | 用户的情绪触发点 |
| `preference` | 偏好 | 用户表达出的沟通偏好 |
| `value` | 价值观 | 用户的核心价值观 |
| `coping_strategy` | 应对策略 | 用户的有效应对方式 |
| `personality` | 性格特征 | 用户的性格特质 |
| `milestone` | 成长时刻 | 用户的进步/成长记录 |
| `general` | 其他 | 未分类的记忆 |

**记忆检索**：使用关键词匹配（indexOf），在 lib/chat.ts 中实现：
1. 将用户消息按空格/标点拆分为关键词
2. 在 memories 数组中遍历，匹配 content 包含任意关键词的记录
3. 排序：`weight × 0.7 + 关键词匹配数 × 0.3`，取 top 5
4. 注入 System Prompt 作为上下文

**Weight 进化逻辑**：
- **递增**：每次被关键词检索命中，weight + 1（在 lib/chat.ts 中实现）
- **用户干预**：用户在记忆管理页可手动调整 weight
- Web 端无后台定时衰减，手机端后续可加 AppState 触发

---

### Topic（话题追踪）

```typescript
type Topic = {
  keywords: string[]
  last_emotion_state?: string
  mention_count: number
  last_mentioned_at: string  // ISO 8601
}
```

存储 Key：`@db:topics`（数组）

跨对话追踪用户反复提及的话题。每次用户发送消息时，lib/chat.ts 用关键词重叠检测当前消息是否匹配已有 topics：

- 匹配成功 → `mention_count + 1`，更新 `last_mentioned_at` 和 `last_emotion_state`
- 匹配失败 → AI 在 think 工具的 `detected_topic` 中可选创建新话题

---

### CustomAction（自定义动作库）

```typescript
type CustomAction = {
  trigger_emotion: string   // 触发情绪，如 '焦虑'
  action_description: string // 动作描述，如 '看 10 分钟猫咪视频'
  effectiveness_score: number // 有效评分，默认 0
}
```

存储 Key：`@db:custom_actions`（数组）

当 AI 检测到用户的当前情绪与某个自定义动作匹配时，主动推荐给用户。

---

## 数据流

### 读操作

所有读操作都是全量读取后过滤：

```typescript
// 例：获取所有 messages
const raw = await AsyncStorage.getItem('@db:messages:conv_123')
const messages: Message[] = raw ? JSON.parse(raw) : []

// 例：获取 milestone 分类的记忆
const mems = await getMemories()
const milestones = mems.filter(m => m.category === 'milestone')
```

### 写操作

所有写操作都是 Read-Modify-Write 模式：

```typescript
// 例：添加一条记忆
export async function saveMemory(memory: Memory): Promise<void> {
  const list = await getMemories()      // 1. 读取全部
  list.push(memory)                      // 2. 修改
  await AsyncStorage.setItem('@db:memories', JSON.stringify(list)) // 3. 写回
}
```

### 事务一致性

AsyncStorage 不支持多 Key 事务。对于需要原子性的操作（如创建对话 + 添加首条消息），lib/chat.ts 按顺序执行写操作，失败时不做回滚（设计上接受最终一致性）。

---

## 遗留的 PostgreSQL 表（已废弃）

以下表是旧版 Supabase 架构中的设计，已全部移除。保留此列表仅用于参考和理解 git 历史：

| 废弃表 | 替代方案 |
|--------|---------|
| `profiles`（含 auth.users 关联） | `@db:profile` |
| `user_preferences` | `@db:preferences` |
| `conversations` | `@db:conversations` |
| `messages` | `@db:messages:{convId}` |
| `memories`（含 embedding / pgvector） | `@db:memories`（关键词匹配替代向量检索） |
| `topics` | `@db:topics` |
| `custom_actions` | `@db:custom_actions` |
| `engagement_signals` | 合并到 lib/chat.ts 内存中，不再持久化 |
| `conversation_summaries` | 待实现（本地存储） |
| `emotional_insights` | 待实现（本地存储） |
| `growth_milestones` | 合并到 `@db:memories`（category=milestone） |
| `personality_presets` | 硬编码在代码中 |
| `action_logs` | 待实现（本地存储） |
| `generated_outputs` | 待实现（本地存储） |
| `voice_sessions` | 待实现（本地存储） |
