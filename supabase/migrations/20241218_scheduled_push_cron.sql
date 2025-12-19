-- ============================================================
-- 예약 푸시 알림 처리를 위한 pg_cron 설정
-- Supabase Pro 플랜에서 사용 가능
-- ============================================================

-- 1. pg_cron 및 pg_net 확장 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. cron 스케마에 대한 권한 부여
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- 3. Edge Function을 호출하는 함수 생성
CREATE OR REPLACE FUNCTION invoke_process_scheduled_push()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_count INTEGER;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- 처리할 예약 작업이 있는지 먼저 확인
  SELECT COUNT(*) INTO pending_count
  FROM push_jobs
  WHERE status = 'queued'
    AND scheduled_at <= NOW();

  -- 처리할 작업이 없으면 종료
  IF pending_count = 0 THEN
    RAISE NOTICE 'No scheduled push jobs to process';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % scheduled push jobs to process', pending_count;

  -- Edge Function URL 구성
  -- 참고: Supabase 프로젝트 URL을 사용합니다
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-scheduled-push';

  -- 기본값 설정 (app.settings가 설정되지 않은 경우)
  IF edge_function_url IS NULL OR edge_function_url = '/functions/v1/process-scheduled-push' THEN
    -- 프로젝트 참조 ID를 직접 설정해야 합니다
    edge_function_url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co/functions/v1/process-scheduled-push';
  END IF;

  -- Service Role Key 가져오기
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- pg_net을 사용하여 Edge Function 호출
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  );

  RAISE NOTICE 'Edge Function invoked successfully';
END;
$$;

-- 4. 기존 cron job이 있으면 삭제
SELECT cron.unschedule('process-scheduled-push')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-push'
);

-- 5. 매분 실행되는 cron job 생성
SELECT cron.schedule(
  'process-scheduled-push',           -- job 이름
  '* * * * *',                        -- 매분 실행
  $$SELECT invoke_process_scheduled_push()$$
);

-- 6. cron job 상태 확인 (선택적)
-- SELECT * FROM cron.job WHERE jobname = 'process-scheduled-push';
