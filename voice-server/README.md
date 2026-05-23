# 雨声语音克隆服务器

基于 OpenVoice v2 的免费语音克隆服务，部署到 Hugging Face Spaces。

## 部署步骤

1. 打开 https://huggingface.co/spaces 并登录（免费注册）
2. 点击 "Create new Space"
3. Space Name: `yusheng-voice`（自定义）
4. License: `mit`
5. Space SDK: `Gradio`
6. 点击 "Create Space"
7. 将本目录的所有文件上传到 Space（通过 Git 或网页上传）
8. Space 自动构建部署（约 5-10 分钟）
9. 部署完成后，复制 Space 的 URL（格式：`https://用户名-空间名.hf.space`）
10. 在 App 设置页填入该 URL

## 使用流程

1. 在 App 中进入设置 → 语音回复 → 开启"使用我的声音"
2. 点击"录制声音"，对着话筒说 20-30 秒的话
3. App 上传录音到服务器，服务器生成声纹 ID
4. 之后 AI 回复时自动调用服务器合成你的声音

## 注意

- 声纹缓存在服务器内存中，重启后需重新录制
- 首次使用时，服务器需要加载模型（约 30 秒冷启动）
- 生成语音延迟约 3-15 秒（CPU）
- 免费版 Hugging Face Space 使用 CPU

## API 端点

部署后，App 通过以下 Gradio API 端点调用：

| 功能 | API Name | 输入 | 输出 |
|------|----------|------|------|
| 声音克隆 | `/api/predict` (clone_voice) | 音频文件 | 声纹 ID |
| 语音合成 | `/api/predict` (text_to_speech) | 文本 + 声纹 ID + 语速 | 音频文件 |
| 快捷 TTS | `/api/predict` (quick_tts) | 文本 + 音频 + 语速 | 音频文件 |
| 健康检查 | `/api/predict` (status) | 无 | JSON 状态 |

App 中配置服务器 URL 后，会自动拼接 API 地址。
