# Bug 报告

> 生成时间：2026-05-22
> 审计方式：完整代码审查
> 范围：src/ 全部源码

---

## 本轮审计结果：未发现新的 Bug

经对全部 30+ 个源文件的完整审查，未发现具有实际影响的 Bug。

### 新增功能概览
- 首页重命名为「雨声」，新增新手指引（Onboarding）、心情签到、三件好事
- 聊天页新增心情速记（MoodPicker）、急救練習（GroundingExercise）、快速回复建议
- 语音输入重构为 voice-input.ts 统一模块（原生 + Web）
- 新增 ErrorBoundary 全局错误边界组件、EmergencyFloatingBtn 急救悬浮按钮
- 新增 utils.ts 共享工具函数（generateId、safeJsonParse、clamp）
- db.ts 新增 ConversationSummary、GratitudeEntry、MoodCheckin 类型及 CRUD
- 语音设置支持 voice-cloning 和自定义服务器 URL
- 首页新增连接测试功能
- 底部导航新增「新手指引」入口
- 串联删除逻辑（删除对话时同步清理 summaries/logs/outputs）
- StreamEvent 新增 session_end / rumination_hint / recall 事件类型

### 代码质量
- 所有数据操作使用 safeJsonParse 安全反序列化
- generateId 统一从 utils.ts 导入，无重复定义
- anySignal 函数正确处理 AbortSignal 的 addEventListener/removeEventListener
- 各页面使用 useTheme + makeStyles 动态样式模式

未发现新的具有实际影响的 Bug。
