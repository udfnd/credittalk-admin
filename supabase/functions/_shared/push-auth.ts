const PUSH_INTERNAL_KEY = 'push_internal';

function secretKeys(): Record<string, string> {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!raw) throw new Error('SUPABASE_SECRET_KEYS is not configured');
  return JSON.parse(raw) as Record<string, string>;
}

function timingSafeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function getPushInternalKey(): string {
  const key = secretKeys()[PUSH_INTERNAL_KEY];
  if (!key) throw new Error(`Missing Supabase secret key: ${PUSH_INTERNAL_KEY}`);
  return key;
}

export function authorizeInternalRequest(request: Request): boolean {
  const supplied = request.headers.get('apikey') ?? '';
  const expected = secretKeys()[PUSH_INTERNAL_KEY] ?? '';
  return Boolean(supplied && expected && timingSafeEqual(supplied, expected));
}

export async function invokePushFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured');
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: getPushInternalKey() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    parsed = { error: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(
      `Push function ${functionName} failed (${response.status}): ${String(
        parsed.error ?? 'unknown error',
      ).slice(0, 500)}`,
    );
  }
  return parsed;
}
