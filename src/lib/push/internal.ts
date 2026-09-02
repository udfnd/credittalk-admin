import 'server-only';

export type CanonicalPushRequest = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
  audience?: { all: true };
  user_ids?: string[];
  target_tokens?: string[];
};

export type CanonicalPushResult = {
  success: boolean;
  partial?: boolean;
  total_tokens_found?: number;
  used_tokens?: number;
  sent?: number;
  failed?: number;
  disabled_tokens?: number;
  error_codes?: Record<string, number>;
  error_samples?: Array<{ code: string; status?: number; message: string }>;
  nid?: string;
  error?: string;
};

export function getSupabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Missing SUPABASE_SECRET_KEY');
  return key;
}

export function normalizeHttpUrl(value: unknown, field: string): string | undefined {
  if (value === null || typeof value === 'undefined' || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  let candidate = value.trim();
  if (!candidate) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${field} is not a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error(`${field} must use http or https`);
  }
  if (parsed.username || parsed.password || candidate.length > 2048) {
    throw new Error(`${field} is not allowed`);
  }
  return parsed.toString();
}

export function normalizePushPayload(
  data: unknown,
  imageUrl: unknown,
): { data: Record<string, unknown>; imageUrl?: string } {
  if (data != null && (typeof data !== 'object' || Array.isArray(data))) {
    throw new Error('data must be an object');
  }
  const normalized: Record<string, unknown> = { ...((data ?? {}) as Record<string, unknown>) };
  const link = normalizeHttpUrl(normalized.link_url, 'link URL');
  const legacyLink = normalizeHttpUrl(normalized.url, 'legacy link URL');
  if (link) normalized.link_url = link;
  else delete normalized.link_url;
  if (legacyLink) normalized.url = legacyLink;
  else delete normalized.url;
  if (link && legacyLink && link !== legacyLink) throw new Error('Conflicting link URLs');

  const normalizedImage = normalizeHttpUrl(imageUrl ?? normalized.image, 'image URL');
  if (normalizedImage) normalized.image = normalizedImage;
  else delete normalized.image;
  if (normalized.screen && (link || legacyLink)) {
    throw new Error('화면 이동과 외부 링크를 동시에 지정할 수 없습니다.');
  }
  return { data: normalized, imageUrl: normalizedImage };
}

export async function invokeCanonicalPush(
  payload: CanonicalPushRequest,
): Promise<CanonicalPushResult> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  const response = await fetch(`${baseUrl}/functions/v1/send-fcm-v1-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: getSupabaseSecretKey(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  });
  const text = await response.text();
  let result: CanonicalPushResult;
  try {
    result = text ? JSON.parse(text) as CanonicalPushResult : { success: false };
  } catch {
    result = { success: false, error: text.slice(0, 500) };
  }
  if (!response.ok) {
    throw new Error(
      `Push sender failed (${response.status}): ${String(result.error ?? 'unknown error').slice(0, 500)}`,
    );
  }
  return result;
}
