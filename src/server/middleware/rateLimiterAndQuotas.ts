import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, computeRequestFingerprint } from './authAndSecurity';
import {
  adminGetDoc,
  adminRunDailyQuotaIncrement,
  PersistenceUnavailableError,
  resetDevPersistenceMemoryForTest,
} from '../persistence/firestoreAdminStore';

export interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

export type SubscriptionTier = 'free' | 'pro' | 'institute';

export interface DailyUidQuotaState {
  uid: string;
  tier: SubscriptionTier;
  dayIso: string;
  requestsUsed: number;
  tokensUsed: number;
  maxRequestsPerDay: number;
  maxTokensPerDay: number;
}

const MAX_MAP_ENTRIES = 10_000;
const BUCKET_TTL_MS = 60 * 60 * 1000; // 1 hour

const rateLimitBuckets = new Map<string, TokenBucketState>();
const dailyQuotaStore = new Map<string, DailyUidQuotaState>();
const userTierStore = new Map<string, SubscriptionTier>();

function pruneMapIfNeeded<K, V>(map: Map<K, V>, maxEntries = MAX_MAP_ENTRIES): void {
  if (map.size < maxEntries) return;
  const deleteCount = Math.ceil(maxEntries * 0.15);
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= deleteCount) break;
  }
}

export function getTierLimits(tier: SubscriptionTier): { maxReq: number; maxTok: number } {
  if (tier === 'institute') return { maxReq: 2500, maxTok: 2_500_000 };
  if (tier === 'pro') return { maxReq: 500, maxTok: 500_000 };
  return { maxReq: 25, maxTok: 25_000 };
}

export function getMaxRequestsPerMinute(): number {
  return Math.max(1, Number(process.env.AI_REQUESTS_PER_MINUTE || 20));
}

export function setStudentSubscriptionTier(uid: string, tier: SubscriptionTier): void {
  pruneMapIfNeeded(userTierStore);
  userTierStore.set(uid, tier);
  const limits = getTierLimits(tier);
  const existing = dailyQuotaStore.get(uid);
  if (existing) {
    existing.tier = tier;
    existing.maxRequestsPerDay = limits.maxReq;
    existing.maxTokensPerDay = limits.maxTok;
  }
}

function isGracefulQuotaFallbackError(err: unknown): boolean {
  if (err instanceof PersistenceUnavailableError) return true;
  const code = String((err as any)?.code ?? '');
  const message = String((err as any)?.message ?? '').toUpperCase();
  return (
    code === '5' ||
    code === '7' ||
    code === '14' ||
    code === 'NOT_FOUND' ||
    code === 'PERMISSION_DENIED' ||
    code === 'UNAVAILABLE' ||
    message.includes('NOT_FOUND') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('PERSISTENCE_UNAVAILABLE')
  );
}

export async function resolveStudentSubscriptionTier(uid: string): Promise<SubscriptionTier> {
  if (!uid || uid === 'anonymous' || uid === 'demo') {
    return 'free';
  }
  try {
    const ent = await adminGetDoc<{ tier?: SubscriptionTier }>('billing_entitlements', uid);
    if (ent?.tier && (ent.tier === 'free' || ent.tier === 'pro' || ent.tier === 'institute')) {
      userTierStore.set(uid, ent.tier);
      return ent.tier;
    }
  } catch (err) {
    if (isGracefulQuotaFallbackError(err)) {
      console.warn(
        `[QuotaTier] Firestore tier lookup unavailable for uid=${uid}; using cached/free tier.`,
        (err as any)?.message || err
      );
      return userTierStore.get(uid) || 'free';
    }
    throw err;
  }
  return userTierStore.get(uid) || 'free';
}

export function getStudentSubscriptionTier(uid: string): SubscriptionTier {
  return userTierStore.get(uid) || 'free';
}

export function consumeTokenBucket(
  fingerprint: string,
  maxPerMinute = getMaxRequestsPerMinute(),
  nowMs = Date.now()
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  if (rateLimitBuckets.size > 1000) {
    for (const [key, val] of rateLimitBuckets.entries()) {
      if (nowMs - val.lastRefillMs > BUCKET_TTL_MS) {
        rateLimitBuckets.delete(key);
      }
    }
    pruneMapIfNeeded(rateLimitBuckets);
  }

  const bucket = rateLimitBuckets.get(fingerprint) || {
    tokens: maxPerMinute,
    lastRefillMs: nowMs,
  };

  const elapsedMinutes = Math.max(0, (nowMs - bucket.lastRefillMs) / 60000);
  if (elapsedMinutes > 0) {
    bucket.tokens = Math.min(maxPerMinute, bucket.tokens + elapsedMinutes * maxPerMinute);
    bucket.lastRefillMs = nowMs;
  }

  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    const retryAfterSeconds = Math.max(2, Math.ceil((deficit / maxPerMinute) * 60));
    rateLimitBuckets.set(fingerprint, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  bucket.tokens -= 1;
  rateLimitBuckets.delete(fingerprint);
  rateLimitBuckets.set(fingerprint, bucket);
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    retryAfterSeconds: 0,
  };
}

export async function consumeTokenBucketDistributed(
  fingerprint: string,
  maxPerMinute = getMaxRequestsPerMinute()
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, '');
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    try {
      const minuteSlot = Math.floor(Date.now() / 60000);
      const redisKey = `learnmate:rl:${minuteSlot}:${fingerprint}`;
      const resp = await fetch(`${upstashUrl}/incr/${encodeURIComponent(redisKey)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal: AbortSignal.timeout(2500),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { result?: number };
        const count = Number(data.result || 1);
        if (count === 1) {
          void fetch(`${upstashUrl}/expire/${encodeURIComponent(redisKey)}/65`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${upstashToken}` },
          }).catch(() => {});
        }
        if (count > maxPerMinute) {
          const retryAfterSeconds = Math.max(2, 60 - Math.floor((Date.now() % 60000) / 1000));
          return { allowed: false, remaining: 0, retryAfterSeconds };
        }
        return {
          allowed: true,
          remaining: Math.max(0, maxPerMinute - count),
          retryAfterSeconds: 0,
        };
      }
    } catch {
      // Fall back to local token bucket if Upstash is temporarily unreachable
    }
  }
  return consumeTokenBucket(fingerprint, maxPerMinute);
}

export async function consumeDailyUidQuota(
  uid: string,
  estimatedTokens = 650
): Promise<{ allowed: boolean; state: DailyUidQuotaState }> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const tier = await resolveStudentSubscriptionTier(uid);
  const limits = getTierLimits(tier);

  // Optional Upstash Redis REST atomic increment when configured
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, '');
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) {
    try {
      const redisKey = `learnmate:quota:${todayIso}:${uid}`;
      const resp = await fetch(`${upstashUrl}/incr/${encodeURIComponent(redisKey)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal: AbortSignal.timeout(2500),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { result?: number };
        const count = Number(data.result || 1);
        if (count === 1) {
          void fetch(`${upstashUrl}/expire/${encodeURIComponent(redisKey)}/172800`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${upstashToken}` },
          }).catch(() => {});
        }
        const state: DailyUidQuotaState = {
          uid,
          tier,
          dayIso: todayIso,
          requestsUsed: count,
          tokensUsed: count * estimatedTokens,
          maxRequestsPerDay: limits.maxReq,
          maxTokensPerDay: limits.maxTok,
        };
        dailyQuotaStore.set(uid, state);
        return {
          allowed: count <= limits.maxReq,
          state,
        };
      }
    } catch {
      // Fall through to persistent Firestore Admin store / graceful in-memory fallback
    }
  }

  try {
    const persisted = await adminRunDailyQuotaIncrement({
      uid,
      dayIso: todayIso,
      tier,
      maxRequestsPerDay: limits.maxReq,
      maxTokensPerDay: limits.maxTok,
      estimatedTokens,
    });

    const state: DailyUidQuotaState = {
      uid,
      tier,
      dayIso: todayIso,
      requestsUsed: persisted.requestsUsed,
      tokensUsed: persisted.tokensUsed,
      maxRequestsPerDay: limits.maxReq,
      maxTokensPerDay: limits.maxTok,
    };
    dailyQuotaStore.set(uid, state);
    return {
      allowed: persisted.allowed,
      state,
    };
  } catch (err) {
    if (isGracefulQuotaFallbackError(err)) {
      console.warn(
        `[QuotaFallback] Firestore daily quota increment unavailable for uid=${uid}; using in-memory fallback.`,
        (err as any)?.message || err
      );
      const prev = dailyQuotaStore.get(uid);
      const prevReqs = prev && prev.dayIso === todayIso ? prev.requestsUsed : 0;
      const prevToks = prev && prev.dayIso === todayIso ? prev.tokensUsed : 0;
      const allowed = prevReqs + 1 <= limits.maxReq;
      const nextState: DailyUidQuotaState = {
        uid,
        tier,
        dayIso: todayIso,
        requestsUsed: allowed ? prevReqs + 1 : prevReqs,
        tokensUsed: allowed ? prevToks + estimatedTokens : prevToks,
        maxRequestsPerDay: limits.maxReq,
        maxTokensPerDay: limits.maxTok,
      };
      dailyQuotaStore.set(uid, nextState);
      return { allowed, state: nextState };
    }
    throw err;
  }
}

export async function getDailyUidQuotaSnapshot(uid: string): Promise<DailyUidQuotaState> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const tier = await resolveStudentSubscriptionTier(uid);
  const limits = getTierLimits(tier);

  try {
    const persisted = await adminGetDoc<{
      dayIso?: string;
      requestsUsed?: number;
      tokensUsed?: number;
    }>('daily_usage_quotas', `${todayIso}_${uid}`);

    if (persisted && persisted.dayIso === todayIso) {
      return {
        uid,
        tier,
        dayIso: todayIso,
        requestsUsed: Number(persisted.requestsUsed || 0),
        tokensUsed: Number(persisted.tokensUsed || 0),
        maxRequestsPerDay: limits.maxReq,
        maxTokensPerDay: limits.maxTok,
      };
    }
  } catch (err) {
    if (!isGracefulQuotaFallbackError(err)) {
      throw err;
    }
    console.warn(
      `[QuotaFallback] Firestore daily quota snapshot unavailable for uid=${uid}; using cached fallback.`,
      (err as any)?.message || err
    );
  }

  const existing = dailyQuotaStore.get(uid);
  if (existing && existing.dayIso === todayIso) {
    return {
      ...existing,
      tier,
      maxRequestsPerDay: limits.maxReq,
      maxTokensPerDay: limits.maxTok,
    };
  }

  return {
    uid,
    tier,
    dayIso: todayIso,
    requestsUsed: 0,
    tokensUsed: 0,
    maxRequestsPerDay: limits.maxReq,
    maxTokensPerDay: limits.maxTok,
  };
}

export function resetRateLimitersForTest(): void {
  rateLimitBuckets.clear();
  dailyQuotaStore.clear();
  userTierStore.clear();
  resetDevPersistenceMemoryForTest();
}

export function createRouteRateLimiter(options: {
  maxPerMinute: number;
  keyPrefix: string;
  errorCode?: string;
}) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const uid = req.userUid || 'anonymous';
    const baseFp = req.clientFingerprint || computeRequestFingerprint(req, uid);
    const key = `${options.keyPrefix}:${baseFp}`;
    const result = consumeTokenBucket(key, options.maxPerMinute);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      res.status(429).json({
        errorCode: options.errorCode || 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests on ${options.keyPrefix}. Retry in ${result.retryAfterSeconds}s.`,
        retryAfterSeconds: result.retryAfterSeconds,
        requestId: req.requestId,
      });
      return;
    }
    next();
  };
}

export async function rateLimiterAndQuotaMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const uid = req.userUid || 'anonymous';
  const fingerprint = req.clientFingerprint || computeRequestFingerprint(req, uid);

  const bucketResult = await consumeTokenBucketDistributed(fingerprint);
  if (!bucketResult.allowed) {
    res.setHeader('Retry-After', String(bucketResult.retryAfterSeconds));
    res.status(429).json({
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit of ${getMaxRequestsPerMinute()} AI requests/minute exceeded. Please wait ${bucketResult.retryAfterSeconds}s and retry.`,
      retryAfterSeconds: bucketResult.retryAfterSeconds,
      requestId: req.requestId,
    });
    return;
  }

  try {
    const quotaResult = await consumeDailyUidQuota(uid);
    if (!quotaResult.allowed) {
      res.status(429).json({
        errorCode: 'DAILY_QUOTA_EXCEEDED',
        message: `Daily ${quotaResult.state.tier.toUpperCase()} tier quota (${quotaResult.state.maxRequestsPerDay} AI requests/day) reached.`,
        retryAfterSeconds: 60,
        quota: quotaResult.state,
        requestId: req.requestId,
      });
      return;
    }
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
      message: err?.message || 'Unable to verify persistent usage quota.',
      requestId: req.requestId,
    });
    return;
  }

  next();
}
