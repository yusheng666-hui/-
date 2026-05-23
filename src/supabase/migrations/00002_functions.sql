-- 辅助函数

-- 向量相似度搜索：匹配用户相关记忆
CREATE OR REPLACE FUNCTION match_memories(
  p_user_id uuid,
  p_embedding vector(512),
  p_match_threshold float DEFAULT 0.5,
  p_match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  category text,
  emotion_tag text,
  weight int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.category,
    m.emotion_tag,
    m.weight,
    1 - (m.embedding <=> p_embedding) AS similarity
  FROM memories m
  WHERE
    m.user_id = p_user_id
    AND m.is_deleted = false
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> p_embedding) > p_match_threshold
  ORDER BY
    similarity * 0.7 + LN(m.weight + 1) * 0.3 DESC
  LIMIT p_match_count;
END;
$$;

-- 对话轮次递增
CREATE OR REPLACE FUNCTION increment_conversation_round(conv_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET current_round = current_round + 1
  WHERE id = conv_id;
END;
$$;

-- 话题提及次数递增
CREATE OR REPLACE FUNCTION increment_mention_count(topic_keywords text[])
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  new_count int;
BEGIN
  UPDATE topics
  SET mention_count = mention_count + 1,
      last_mentioned_at = now()
  WHERE keywords = topic_keywords
  RETURNING mention_count INTO new_count;
  RETURN new_count;
END;
$$;

-- 后台清理任务：清理过期数据
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. 软删除 90 天以上且 weight < 3 的记忆
  UPDATE memories
  SET is_deleted = true
  WHERE created_at < now() - interval '90 days'
    AND weight < 3
    AND is_deleted = false;

  -- 2. 标记 30 天未提及的话题
  UPDATE topics
  SET is_active = false
  WHERE last_mentioned_at < now() - interval '30 days'
    AND is_active = true;

  -- 3. 清理 60 天前的信号日志
  DELETE FROM engagement_signals
  WHERE created_at < now() - interval '60 days';

  -- 4. 记忆权重衰减（每周衰减 10%，最低 1）
  UPDATE memories
  SET weight = GREATEST(1, ROUND(weight * 0.9))
  WHERE weight > 1;
END;
$$;

-- 批量获取每个对话的最新一条用户消息
CREATE OR REPLACE FUNCTION get_latest_messages(p_conversation_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  content text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.content
  FROM messages m
  WHERE m.conversation_id = ANY(p_conversation_ids)
    AND m.role = 'user'
  ORDER BY m.conversation_id, m.created_at DESC;
END;
$$;
