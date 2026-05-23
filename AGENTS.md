# AGENTS.md — 给 AI 开发者的使用说明

## 项目概览

这是一个 **雨声** 项目，目标是一个自我进化的情绪陪伴工具。AI 越用越懂用户，核心设计文档位于 `docs/`。

---

## 目录结构说明

### `docs/` — 文档与设计素材

存放所有产品文档和技术文档。

| 文件 | 内容 |
|------|------|
| `docs/0-OVERVIEW.md` | 产品定位、目标用户、核心原则 |
| `docs/1-ARCHITECTURE.md` | 技术架构、数据流、Edge Function 设计 |
| `docs/2-DATABASE.md` | 数据库表结构、向量检索、weight 进化逻辑 |
| `docs/3-AGENT-LOGIC.md` | System Prompt、工具定义、工具调用处理 |
| `docs/4-UI-UX.md` | 页面结构、聊天页、配置页、记忆管理、情绪洞察 |

子目录：
- `docs/assets/design/` — 效果图、UI 设计稿、交互原型（.png, .fig, .sketch 等）
- `docs/assets/bug/` — 存在的bug
- `docs/assets/reference/` — 参考图、灵感收集

> **规则**：所有正式文档必须放在 `docs/` 下，不得散落根目录或其他位置。

### `notes/` — 学习笔记

存放开发中踩过的坑、学到的技术方案、临时调研记录。笔记可随意组织，成熟后可转为正式文档移到 `docs/`。

### `src/` — 源代码

所有项目代码（前端、后端、工具脚本）。

> **规则**：
> - 代码不得引用外部未收录的文件
> - 图片等静态资源必须放在 `docs/assets/` 中引用，或复制到 `src/` 下的资源目录
> - 文档和笔记不得混入 `src/`

---

## 开发与协作规则

1. **先读文档** — 接入前必读 `docs/` 下的 5 个设计文档，理解完整架构后再写代码。
2. **文档归文档，代码归代码** — `docs/` 和 `notes/` 的内容不混入 `src/`。
3. **外部素材统一管理** — 设计素材、截图、参考图统一放 `docs/assets/`。
4. **决策留痕** — 重要技术选型、产品决策记录到 `docs/` 下的对应文档中，方便回溯。
5. **README 即门面** — `README.md` 保持精简，指向 `docs/` 中的详细文档。

---

## 快速导航

| 目的 | 路径 |
|------|------|
| 产品定位与原则 | `docs/0-OVERVIEW.md` |
| 技术架构 | `docs/1-ARCHITECTURE.md` |
| 数据库设计 | `docs/2-DATABASE.md` |
| AI Agent 逻辑 | `docs/3-AGENT-LOGIC.md` |
| 界面设计 | `docs/4-UI-UX.md` |
| 设计素材 | `docs/assets/design/` |
| 报错截图 | `docs/assets/bug/` |
| 参考图 | `docs/assets/reference/` |
| 学习笔记 | `notes/` |
| 源代码 | `src/` |
