-- ============================================================
-- 예약 푸시 알림 처리를 위한 pg_cron 설정 (간단 버전)
-- Supabase Dashboard > SQL Editor에서 실행하세요.
-- ============================================================

-- 1. pg_cron 및 pg_net 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Edge Function을 직접 호출하는 cron job 생성
-- ⚠️ 아래 값들을 실제 값으로 교체하세요:
--    - YOUR_PROJECT_REF: Supabase 프로젝트 참조 ID (예: abcdefghijklmnop)
--    - YOUR_SERVICE_ROLE_KEY: Supabase Service Role Key

-- 기존 job 삭제 (있는 경우)
SELECT cron.unschedule('process-scheduled-push')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-push');

-- 매분 실행되는 cron job 생성
SELECT cron.schedule(
  'process-scheduled-push',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-push',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3. cron job 확인
SELECT * FROM cron.job WHERE jobname = 'process-scheduled-push';

-- ============================================================
-- 유용한 관리 쿼리들
-- ============================================================

-- cron job 실행 기록 확인
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- cron job 일시 중지
-- UPDATE cron.job SET active = false WHERE jobname = 'process-scheduled-push';

-- cron job 재개
-- UPDATE cron.job SET active = true WHERE jobname = 'process-scheduled-push';

-- cron job 삭제
-- SELECT cron.unschedule('process-scheduled-push');
