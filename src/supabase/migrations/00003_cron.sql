-- 定时清理任务
-- 需要 Supabase 项目启用 pg_cron 扩展
-- 启用方式: 在 Supabase Dashboard -> SQL Editor 运行:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 或者在项目设置中开启 pg_cron 扩展

-- 每周日凌晨 3:00 执行过期数据清理
SELECT cron.schedule(
  'cleanup-expired-data',
  '0 3 * * 0',
  $$SELECT cleanup_expired_data()$$
);
