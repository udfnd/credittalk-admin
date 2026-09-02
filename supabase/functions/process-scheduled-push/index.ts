/** Claims due jobs atomically and delegates delivery to the canonical FCM sender. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authorizeInternalRequest,
  getPushInternalKey,
  invokePushFunction,
} from '../_shared/push-auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const adminKey = getPushInternalKey();
const supabaseAdmin = createClient(SUPABASE_URL, adminKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type PushJob = {
  id: number;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  audience: Record<string, unknown> | null;
  target_user_ids: Array<string | number> | null;
  attempt_count: number | null;
};

const MAX_ATTEMPTS = 6;
const RETRY_DELAYS_MINUTES = [1, 5, 15, 30, 60];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function updateJob(id: number, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin
    .from('push_jobs')
    .update(values)
    .eq('id', id)
    .eq('status', 'processing');
  if (error) throw error;
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    if (!authorizeInternalRequest(request)) return json({ error: 'Unauthorized' }, 401);

    const { data: claimed, error: claimError } = await supabaseAdmin.rpc(
      'claim_due_push_jobs',
      { p_limit: 10 },
    );
    if (claimError) throw claimError;
    const jobs = (claimed ?? []) as PushJob[];
    const outcomes: Array<Record<string, unknown>> = [];

    for (const job of jobs) {
      try {
        const audienceAll = job.audience?.all === true;
        const userIds = (job.target_user_ids ?? []).map(String).filter(Boolean);
        if (!audienceAll && userIds.length === 0) {
          throw new Error('Scheduled push has no audience');
        }
        const result = await invokePushFunction('send-fcm-v1-push', {
          title: job.title,
          body: job.body,
          data: {
            ...(job.data ?? {}),
            nid:
              typeof job.data?.nid === 'string' && job.data.nid
                ? job.data.nid
                : `push_job_${job.id}`,
          },
          ...(audienceAll ? { audience: { all: true } } : { user_ids: userIds }),
        });
        await updateJob(job.id, {
          status: 'done',
          result,
          locked_at: null,
          last_error: null,
        });
        outcomes.push({ job_id: job.id, status: 'done', ...result });
      } catch (error) {
        const message = String((error as Error)?.message ?? error).slice(0, 500);
        const attempt = Number(job.attempt_count ?? 1);
        if (attempt < MAX_ATTEMPTS) {
          const retryMinutes = RETRY_DELAYS_MINUTES[Math.max(0, attempt - 1)];
          await updateJob(job.id, {
            status: 'queued',
            scheduled_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
            locked_at: null,
            last_error: message,
            result: { error: message, retry_scheduled: true, attempt },
          });
          outcomes.push({ job_id: job.id, status: 'queued_for_retry', attempt });
        } else {
          await updateJob(job.id, {
            status: 'failed',
            locked_at: null,
            last_error: message,
            result: { error: message, attempt },
          });
          outcomes.push({ job_id: job.id, status: 'failed', attempt });
        }
      }
    }
    return json({ ok: true, processed: jobs.length, outcomes });
  } catch (error) {
    const message = String((error as Error)?.message ?? error).slice(0, 500);
    console.error('[process-scheduled-push]', message);
    return json({ ok: false, error: message }, 500);
  }
});
