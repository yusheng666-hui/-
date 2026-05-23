import gradio as gr
import torch
import soundfile as sf
import numpy as np
import os
import uuid
import time
import tempfile
from pathlib import Path
from huggingface_hub import snapshot_download

# ============================================================
# OpenVoice v2 Voice Cloning Server
# Deploy to Hugging Face Spaces (free tier)
# ============================================================

MODEL_DIR = Path("/tmp/openvoice-models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)
VOICE_CACHE = Path("/tmp/voice-embeddings")
VOICE_CACHE.mkdir(parents=True, exist_ok=True)

# In-memory voice embedding cache
voice_embeddings: dict[str, torch.Tensor] = {}

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[OpenVoice] Using device: {device}")

# ====== Download models ======
print("[OpenVoice] Downloading OpenVoice v2 models...")
model_path = snapshot_download(
    repo_id="myshell-ai/OpenVoice-v2",
    local_dir=str(MODEL_DIR / "OpenVoice-v2"),
    local_dir_use_symlinks=False,
)
print(f"[OpenVoice] Models downloaded to {model_path}")

# ====== Load models ======
print("[OpenVoice] Loading MeloTTS (Chinese)...")
from melo.api import TTS
melo_tts = TTS(language="CN", device=device)
speaker_ids = list(melo_tts.hps.data.spk2id.keys())
cn_default_speaker = speaker_ids[0]
print(f"[OpenVoice] MeloTTS loaded. Speakers: {speaker_ids}")

print("[OpenVoice] Loading ToneColorConverter...")
from openvoice.api import ToneColorConverter
from openvoice import se_extractor

checkpoint_dir = model_path / "checkpoints"
tone_color_converter = ToneColorConverter(
    str(checkpoint_dir / "converter" / "config.json"),
    device=device,
)
tone_color_converter.load_ckpt(
    str(checkpoint_dir / "converter" / "checkpoint.pth")
)

# Pre-extracted source speaker embeddings (MeloTTS default voices)
cn_default_se = torch.load(
    str(checkpoint_dir / "base_speakers" / "ses" / "cn_default_se.pth"),
    map_location=device,
)
print("[OpenVoice] Models loaded successfully!")

# ====== Helper: load embedding from file or cache ======
def get_voice_embedding(voice_id: str) -> torch.Tensor | None:
    if voice_id in voice_embeddings:
        return voice_embeddings[voice_id]
    cache_path = VOICE_CACHE / f"{voice_id}.pt"
    if cache_path.exists():
        se = torch.load(cache_path, map_location=device)
        voice_embeddings[voice_id] = se
        return se
    return None

# ====== Core functions ======
def clone_voice(audio_path: str) -> tuple[str, str]:
    """
    Extract speaker embedding from reference audio.
    Returns (voice_id, status_message)
    """
    if not audio_path or not os.path.exists(audio_path):
        return "", "错误：未检测到音频文件"

    voice_id = str(uuid.uuid4())
    try:
        target_se, _ = se_extractor.get_se(
            audio_path,
            tone_color_converter,
            vad=True,
        )
        voice_embeddings[voice_id] = target_se
        # Persist to disk
        torch.save(target_se, VOICE_CACHE / f"{voice_id}.pt")
        return voice_id, f"✅ 声音克隆成功！你的声纹 ID: {voice_id}"
    except Exception as e:
        return "", f"❌ 声音克隆失败: {str(e)}"


def list_voices() -> list[str]:
    """List available voice IDs"""
    voices = list(voice_embeddings.keys())
    # Also scan cache dir
    for f in VOICE_CACHE.glob("*.pt"):
        vid = f.stem
        if vid not in voice_embeddings:
            voices.append(vid)
    return voices if voices else ["(no voices cloned yet)"]


def text_to_speech(
    text: str,
    voice_id: str,
    speed: float = 1.0,
) -> tuple[str | None, str]:
    """
    Generate speech with cloned voice.
    Returns (audio_path, status_message)
    """
    if not text or not text.strip():
        return None, "错误：请输入文本"

    # Get target speaker embedding
    target_se = get_voice_embedding(voice_id) if voice_id else None

    # Generate base audio with MeloTTS
    base_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    melo_tts.tts_to_file(
        text,
        cn_default_speaker,
        base_path,
        speed=speed,
    )

    if target_se is not None:
        # Apply voice cloning via tone color conversion
        output_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
        try:
            tone_color_converter.convert(
                audio_src_path=base_path,
                src_se=cn_default_se,
                tgt_se=target_se,
                output_path=output_path,
            )
            os.unlink(base_path)
            return output_path, "✅ 语音生成成功（已应用声纹）"
        except Exception as e:
            os.unlink(output_path)
            return base_path, f"⚠️ 声纹转换失败，使用原始语音: {str(e)}"
    else:
        return base_path, "✅ 语音生成成功（默认声音，未克隆）"


def quick_tts(text: str, audio_path: str, speed: float = 1.0) -> str | None:
    """
    One-step TTS: upload reference audio + text → get speech.
    Used directly from Gradio UI.
    """
    if not text or not text.strip():
        return None

    voice_id = ""
    if audio_path and os.path.exists(audio_path):
        try:
            target_se, _ = se_extractor.get_se(
                audio_path,
                tone_color_converter,
                vad=True,
            )
            voice_id = "temp_" + str(uuid.uuid4())
            voice_embeddings[voice_id] = target_se
        except Exception:
            pass

    result_path, _ = text_to_speech(text, voice_id, speed)
    return result_path


# ====== Health check endpoint ======
def health_check():
    return {
        "status": "ok",
        "device": device,
        "voices_cached": len(voice_embeddings),
        "model": "OpenVoice v2 + MeloTTS",
    }


# ====== Gradio UI ======
with gr.Blocks(title="雨声 - 语音克隆服务器", css="footer{display:none}") as demo:
    gr.Markdown(
        """
        # 🎤 雨声 - 语音克隆服务器

        基于 OpenVoice v2 + MeloTTS 的免费语音克隆服务。

        **使用步骤：**
        1. 在「录制声音」标签页上传一段你的语音（建议 10-30 秒，中文）
        2. 获得你的声纹 ID
        3. 在「文字转语音」标签页输入文本 + 声纹 ID，生成你的声音

        > 声纹仅保存在服务器内存中，重启后需重新录制。
        > 首次使用需加载模型（约 30 秒冷启动）。
        """
    )

    with gr.Tab("🎙️ 录制声音"):
        gr.Markdown("### 上传一段你的语音\n建议：安静环境，自然说话 10-30 秒，中文")

        with gr.Row():
            audio_input = gr.Audio(
                sources=["microphone", "upload"],
                type="filepath",
                label="录制或上传语音",
            )

        with gr.Row():
            clone_btn = gr.Button("🎯 克隆此声音", variant="primary", size="lg")

        with gr.Row():
            voice_id_output = gr.Textbox(label="声纹 ID", interactive=True)
            clone_status = gr.Textbox(label="状态")

        clone_btn.click(
            fn=clone_voice,
            inputs=[audio_input],
            outputs=[voice_id_output, clone_status],
            api_name="clone_voice",
        )

        with gr.Row():
            refresh_btn = gr.Button("刷新已克隆的声音列表")
            voice_list = gr.Dropdown(
                choices=[],
                label="已克隆的声音",
                interactive=True,
            )

        refresh_btn.click(
            fn=lambda: gr.Dropdown(choices=list_voices()),
            inputs=[],
            outputs=[voice_list],
        )

    with gr.Tab("🔊 文字转语音"):
        gr.Markdown("### 用克隆的声音朗读任意文本")

        with gr.Row():
            tts_text = gr.Textbox(
                label="输入文本",
                placeholder="说点什么...",
                lines=3,
            )

        with gr.Row():
            tts_voice_id = gr.Textbox(
                label="声纹 ID（留空则使用默认声音）",
                placeholder="粘贴上面获得的声纹 ID",
            )

        with gr.Row():
            tts_speed = gr.Slider(
                minimum=0.5,
                maximum=2.0,
                value=1.0,
                step=0.1,
                label="语速",
            )

        with gr.Row():
            tts_btn = gr.Button("🔊 生成语音", variant="primary", size="lg")

        with gr.Row():
            tts_audio = gr.Audio(label="生成的语音", type="filepath")
            tts_status = gr.Textbox(label="状态")

        tts_btn.click(
            fn=text_to_speech,
            inputs=[tts_text, tts_voice_id, tts_speed],
            outputs=[tts_audio, tts_status],
            api_name="text_to_speech",
        )

    with gr.Tab("⚡ 快捷模式"):
        gr.Markdown("### 一站式：上传声音 + 输入文本 + 生成语音")

        with gr.Row():
            quick_audio = gr.Audio(
                sources=["microphone", "upload"],
                type="filepath",
                label="参考语音（可选，留空则使用默认声音）",
            )

        with gr.Row():
            quick_text = gr.Textbox(
                label="输入文本",
                placeholder="说点什么...",
                lines=3,
            )

        with gr.Row():
            quick_speed = gr.Slider(
                minimum=0.5,
                maximum=2.0,
                value=1.0,
                step=0.1,
                label="语速",
            )

        with gr.Row():
            quick_btn = gr.Button("🔊 生成", variant="primary", size="lg")

        with gr.Row():
            quick_audio_out = gr.Audio(label="生成的语音", type="filepath")

        quick_btn.click(
            fn=quick_tts,
            inputs=[quick_text, quick_audio, quick_speed],
            outputs=[quick_audio_out],
            api_name="quick_tts",
        )

    with gr.Tab("ℹ️ 状态"):
        gr.Markdown("### 服务器状态")

        with gr.Row():
            status_btn = gr.Button("刷新状态")

        with gr.Row():
            status_json = gr.JSON(label="服务器信息", value={"status": "loading..."})

        status_btn.click(
            fn=health_check,
            inputs=[],
            outputs=[status_json],
            api_name="status",
        )

if __name__ == "__main__":
    demo.queue(default_concurrency_limit=5).launch(show_api=True)
