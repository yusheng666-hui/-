-- 情绪救助 数据库 Schema
-- 需要先启用 pgvector 扩展

-- 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ========================
-- 1. profiles（用户配置表）
-- ========================
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  personality_prompt text NOT NULL DEFAULT '你是一个温柔且洞察人心的树洞，先肯定情绪，再引导思考。',
  learning_stage text NOT NULL DEFAULT 'cold_start'
    CHECK (learning_stage IN ('cold_start', 'calibration', 'deep_tuning')),
  interaction_count int NOT NULL DEFAULT 0,
  adaptation_version int NOT NULL DEFAULT 0,
  vocabulary_map jsonb NOT NULL DEFAULT '{}',
  current_personality text NOT NULL DEFAULT 'tree_hole'
    CHECK (current_personality IN ('tree_hole', 'frenemy', 'elder', 'battle_buddy')),
  notification_settings jsonb NOT NULL DEFAULT '{
    "key_event_reminder": true,
    "inactive_48h_checkin": true,
    "weekly_summary": true,
    "quiet_hours_start": null,
    "quiet_hours_end": null
  }',
  widget_config jsonb NOT NULL DEFAULT '{
    "show_emotion_word": true,
    "show_quote": true,
    "quick_action": "journal"
  }',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========================
-- 2. conversations（对话表）
-- ========================
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'chat'
    CHECK (mode IN ('chat', 'journal', 'low_power', 'emergency')),
  round_limit int,
  current_round int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- ========================
-- 3. messages（消息表）
-- ========================
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'thought', 'journal')),
  content text NOT NULL,
  quality_score int CHECK (quality_score >= 1 AND quality_score <= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ========================
-- 4. memories（灵魂记忆库）
-- ========================
CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  category text NOT NULL CHECK (category IN ('trigger', 'preference', 'value', 'coping', 'trait')),
  emotion_tag text,
  embedding vector(512),
  weight int NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_embedding ON memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ========================
-- 5. custom_actions（用户自定义动作库）
-- ========================
CREATE TABLE custom_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trigger_emotion text NOT NULL,
  action_description text NOT NULL,
  effectiveness_score int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_actions_user_id ON custom_actions(user_id);
CREATE INDEX idx_custom_actions_emotion ON custom_actions(trigger_emotion);

-- ========================
-- 6. user_preferences（多维偏好模型）
-- ========================
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dimension text NOT NULL
    CHECK (dimension IN ('tone', 'advice_style', 'confrontation_comfort', 'humor', 'response_depth', 'emotional_expressiveness')),
  value text NOT NULL,
  confidence float NOT NULL DEFAULT 0.5
    CHECK (confidence >= 0 AND confidence <= 1),
  sample_count int NOT NULL DEFAULT 1,
  history jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, dimension)
);

-- ========================
-- 7. engagement_signals（互动信号日志）
-- ========================
CREATE TABLE engagement_signals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('positive', 'negative', 'neutral')),
  signal_key text NOT NULL
    CHECK (signal_key IN (
      'agreement', 'gratitude', 'emotional_resonance', 'self_disclosure',
      'disagreement', 'topic_abandonment', 'short_reply', 'confusion',
      'continued_engagement'
    )),
  confidence float NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  detection_layer text NOT NULL CHECK (detection_layer IN ('regex', 'embedding', 'llm', 'hybrid')),
  context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_user_id ON engagement_signals(user_id);
CREATE INDEX idx_signals_created_at ON engagement_signals(created_at);

-- ========================
-- 8. conversation_summaries（对话摘要表）
-- ========================
CREATE TABLE conversation_summaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  summary text NOT NULL,
  emotional_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_summaries_conversation_id ON conversation_summaries(conversation_id);

-- ========================
-- 9. emotional_insights（情绪洞察表）
-- ========================
CREATE TABLE emotional_insights (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  summary text NOT NULL,
  patterns_detected jsonb NOT NULL DEFAULT '[]',
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_insights_user_id ON emotional_insights(user_id);
CREATE INDEX idx_insights_generated_at ON emotional_insights(generated_at DESC);

-- ========================
-- 10. topics（话题追踪表）
-- ========================
CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keywords text[] NOT NULL,
  first_mentioned_at timestamptz NOT NULL DEFAULT now(),
  last_mentioned_at timestamptz NOT NULL DEFAULT now(),
  mention_count int NOT NULL DEFAULT 1,
  last_emotion_state text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_topics_user_id ON topics(user_id);
CREATE INDEX idx_topics_active ON topics(is_active) WHERE is_active = true;

-- ========================
-- 11. growth_milestones（成长里程碑）
-- ========================
CREATE TABLE growth_milestones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_type text NOT NULL
    CHECK (milestone_type IN ('pattern_break', 'new_perspective', 'self_discovery', 'coping_success', 'positive_shift')),
  description text NOT NULL,
  source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_user_id ON growth_milestones(user_id);

-- ========================
-- 12. personality_presets（AI 人格预设库）
-- ========================
CREATE TABLE personality_presets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL CHECK (key IN ('tree_hole', 'frenemy', 'elder', 'battle_buddy')),
  name text NOT NULL,
  description text NOT NULL,
  system_prompt_template text NOT NULL,
  suggested_scenes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO personality_presets (key, name, description, system_prompt_template, suggested_scenes) VALUES
('tree_hole', '树洞', '温柔承接，不输出观点', '重点在于听懂，不是给出答案。用户不需要被解决，需要被接住。\n你的任务是承接情绪，不输出观点，不比用户看得更远。\n用户没说的问题不要去挖掘，用户没问的建议不要去给。', ARRAY['想被听懂', '需要倾诉']),
('frenemy', '损友', '毒舌但关心，用吐槽表达在意', '你和用户的关系到了才能毒舌。先判断用户接不接受这种风格。\n核心是关心，表面是毒舌。用吐槽的方式表达在意：\n"你又开始了是吧，上次不是聊过这个了吗"\n如果用户表现出不适，立即切回温柔模式。', ARRAY['需要被骂醒', '自我纠结']),
('elder', '长辈', '温和过来人视角，不讲大道理', '不讲大道理，不说"你应该"。分享视角，不是给指令。\n用"我以前也遇到过类似的事"句式。\n语气平和，不评判，不焦虑。用户不需要被拯救，只需要被理解。', ARRAY['想要指点', '迷茫']),
('battle_buddy', '战友', '陪你一起吐槽，一起骂', '陪用户一起骂，一起吐槽。\n先共情再行动——用户没吐槽完之前不要出主意。\n"啥？这也太过分了吧" / "就是啊，凭什么"\n等用户情绪释放完了，再问"那你想怎么办"。', ARRAY['需要并肩感', '一起吐槽']);

-- ========================
-- 13. action_logs（真实动作记录）
-- ========================
CREATE TABLE action_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  action_description text NOT NULL,
  feedback text CHECK (feedback IN ('done', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_logs_user_id ON action_logs(user_id);

-- ========================
-- 14. generated_outputs（AI 微任务产出）
-- ========================
CREATE TABLE generated_outputs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  output_type text NOT NULL
    CHECK (output_type IN ('reply_draft', 'decision_card', 'diary_draft', 'thank_letter', 'apology_letter', 'emotion_card', 'chat_export')),
  title text NOT NULL,
  content text NOT NULL,
  source_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'exported', 'deleted')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_outputs_user_id ON generated_outputs(user_id);
CREATE INDEX idx_generated_outputs_status ON generated_outputs(status);

-- ========================
-- 15. voice_sessions（语音情感分析记录）
-- ========================
CREATE TABLE voice_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  duration_ms int,
  avg_speed float,
  pause_frequency float,
  avg_pause_duration float,
  volume_variance float,
  detected_emotion text,
  features_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_sessions_user_id ON voice_sessions(user_id);
