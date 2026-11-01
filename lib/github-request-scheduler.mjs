import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_QUEUE_SIZE = 64;
const DEFAULT_QUEUE_WAIT_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;

export class GitHubRateLimitError extends Error {
    constructor(retryAfter = 60, message = 'GitHub requests are temporarily limited.') {
        super(message);
        this.name = 'GitHubRateLimitError';
        this.status = 429;
        this.retryAfter = Math.max(1, Math.ceil(retryAfter));
    }
}

export class GitHubSchedulerUnavailableError extends Error {
    constructor() {
        super('GitHub request coordination is temporarily unavailable.');
        this.name = 'GitHubSchedulerUnavailableError';
        this.status = 503;
        this.retryAfter = 5;
    }
}

// All keys share the credential hash tag, so this also works with Redis Cluster.
// Redis time, not a function instance's wall clock, determines lease expiry.
const ACQUIRE_LEASE = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local cooldown = math.max(redis.call('PTTL', KEYS[2]), redis.call('PTTL', KEYS[3]))
if cooldown > 0 then return {0, cooldown} end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then
    local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
    return {0, math.max(1, tonumber(first[2]) - now)}
end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[2]), ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return {1, 0}
`;

const EXTEND_COOLDOWN = `
local remaining = redis.call('PTTL', KEYS[1])
if remaining < tonumber(ARGV[1]) then
    redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
end
return 1
`;

const CHECK_COOLDOWN = `
return math.max(0, redis.call('PTTL', KEYS[1]), redis.call('PTTL', KEYS[2]))
`;

const ADMIT_LOOKUP = `
local remaining = redis.call('PTTL', KEYS[1])
if remaining <= 0 then
    redis.call('SET', KEYS[1], '1', 'PX', ARGV[2])
    return 0
end
if tonumber(redis.call('GET', KEYS[1])) >= tonumber(ARGV[1]) then return remaining end
redis.call('INCR', KEYS[1])
return 0
`;

function credentialKey(options) {
    const authorization = new Headers(options.headers).get('authorization') || 'anonymous';
    return createHash('sha256').update(authorization).digest('hex');
}

function requestResource(url) {
    const { pathname } = new URL(url);
    if (pathname === '/graphql') return 'graphql';
    return pathname.startsWith('/search/') ? 'search' : 'core';
}

function retrySafe(url, options) {
    const method = (options.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return true;
    if (method !== 'POST' || requestResource(url) !== 'graphql') return false;
    try {
        return /^(?:query\b|\{)/.test(JSON.parse(options.body).query.trim());
    } catch {
        return false;
    }
}

function delay(ms, signal) {
    return new Promise((resolve, reject) => {
        signal?.throwIfAborted();
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function configuredRedis(env) {
    const explicit = env.GITHUB_REDIS_REST_URL || env.GITHUB_REDIS_REST_TOKEN;
    const url = explicit ? env.GITHUB_REDIS_REST_URL : env.UPSTASH_REDIS_REST_URL;
    const token = explicit ? env.GITHUB_REDIS_REST_TOKEN : env.UPSTASH_REDIS_REST_TOKEN;
    if (!url && !token) return null;
    // A partially configured coordinator must not silently fall back to local limits.
    return { url, token };
}

function createRedisCoordinator(config, fetchImpl, concurrency, leaseMs) {
    async function command(args) {
        try {
            if (!config.url || !config.token || new URL(config.url).protocol !== 'https:') {
                throw new Error('Invalid coordinator configuration');
            }
            const response = await fetchImpl(config.url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(args),
                cache: 'no-store',
                signal: AbortSignal.timeout(2_000),
            });
            if (!response.ok) throw new Error('Coordinator request failed');
            const payload = await response.json();
            if (payload.error || !Object.hasOwn(payload, 'result')) throw new Error('Invalid coordinator response');
            return payload.result;
        } catch {
            // Never include the Redis endpoint, credentials, or response body in errors.
            throw new GitHubSchedulerUnavailableError();
        }
    }

    const prefix = (key) => `portfolio:github:{${key}}`;
    return {
        async acquire(key, resource) {
            const id = randomUUID();
            const result = await command([
                'EVAL', ACQUIRE_LEASE, 3,
                `${prefix(key)}:leases`, `${prefix(key)}:cooldown:${resource}`, `${prefix(key)}:cooldown:all`,
                concurrency, leaseMs, id,
            ]);
            if (!Array.isArray(result) || result.length !== 2 || ![0, 1].includes(result[0]) || !Number.isFinite(result[1])) {
                throw new GitHubSchedulerUnavailableError();
            }
            if (!result[0]) throw new GitHubRateLimitError(result[1] / 1000);
            return async () => {
                // A failed release only holds capacity until the finite lease expires.
                // Admission continues to fail closed if Redis remains unavailable.
                try { await command(['ZREM', `${prefix(key)}:leases`, id]); } catch {}
            };
        },
        async cooldown(key, resource, ms) {
            await command(['EVAL', EXTEND_COOLDOWN, 1, `${prefix(key)}:cooldown:${resource}`, Math.ceil(ms)]);
        },
        async check(key, resource) {
            const remaining = await command(['EVAL', CHECK_COOLDOWN, 2,
                `${prefix(key)}:cooldown:${resource}`, `${prefix(key)}:cooldown:all`]);
            if (!Number.isFinite(remaining) || remaining < 0) throw new GitHubSchedulerUnavailableError();
            if (remaining > 0) throw new GitHubRateLimitError(remaining / 1000);
        },
        async admitLookup(key, maximum, windowMs) {
            const remaining = await command(['EVAL', ADMIT_LOOKUP, 1, `${prefix(key)}:lookups`, maximum, windowMs]);
            if (!Number.isFinite(remaining) || remaining < 0) throw new GitHubSchedulerUnavailableError();
            if (remaining > 0) throw new GitHubRateLimitError(remaining / 1000, 'GitHub profile lookups are temporarily limited.');
        },
    };
}

async function rateLimitObservation(response, resource, now) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    const retryHeader = response.headers.get('retry-after');
    const retryMs = retryHeader === null ? 0 : (/^\d+(?:\.\d+)?$/.test(retryHeader)
        ? Number(retryHeader) * 1000 : Date.parse(retryHeader) - now);
    let payload;
    if (response.status === 403 || response.status === 429 || resource === 'graphql') {
        try { payload = await response.clone().json(); } catch {}
    }
    const isRateMessage = (value) => /rate.?limit|secondary limit|abuse detection/i.test(value || '');
    const graphqlLimit = Array.isArray(payload?.errors) && payload.errors.some((error) =>
        error.type === 'RATE_LIMITED' || error.extensions?.code === 'RATE_LIMITED' || isRateMessage(error.message));
    const throttled = response.status === 429
        || (response.status === 403 && (remaining === '0' || retryHeader !== null || isRateMessage(payload?.message)))
        || graphqlLimit;
    if (!throttled && remaining !== '0') return null;
    const primary = remaining === '0' && retryHeader === null;
    const ms = Number.isFinite(retryMs) && retryMs > 0 ? retryMs
        : (primary && Number.isFinite(reset) && reset > now ? reset - now : 60_000);
    return { resource: primary ? (response.headers.get('x-ratelimit-resource') || resource) : 'all', ms, throttled };
}

/**
 * A bounded scheduler shared by all GitHub reads in this process. If Redis REST
 * is configured, atomic leases and cooldowns also cover other app instances.
 * performRequest(signal) MUST pass the supplied signal to the underlying fetch.
 */
export function createGitHubScheduler({
    maxConcurrency = DEFAULT_CONCURRENCY,
    maxQueue = DEFAULT_QUEUE_SIZE,
    maxQueueWaitMs = DEFAULT_QUEUE_WAIT_MS,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    maxLookupsPerWindow = 30,
    lookupWindowMs = 60_000,
    now = Date.now,
    sleep = delay,
    random = Math.random,
    fetch: fetchImpl = (...args) => fetch(...args),
    redis = configuredRedis(process.env),
} = {}) {
    if (![maxConcurrency, maxQueue, maxQueueWaitMs, requestTimeoutMs, maxLookupsPerWindow, lookupWindowMs].every(Number.isSafeInteger)
        || maxConcurrency < 1 || maxQueue < 0 || maxQueueWaitMs < 1 || requestTimeoutMs < 1
        || maxLookupsPerWindow < 1 || lookupWindowMs < 1) {
        throw new TypeError('Invalid GitHub scheduler limits');
    }
    const buckets = new Map();
    const coordinator = redis ? createRedisCoordinator(redis, fetchImpl, maxConcurrency, requestTimeoutMs + 5_000) : null;

    function cooldownError(bucket, resource) {
        const until = Math.max(bucket.cooldowns.get(resource) || 0, bucket.cooldowns.get('all') || 0);
        return until > now() ? new GitHubRateLimitError((until - now()) / 1000) : null;
    }

    function acquireLocal(bucket, resource, signal) {
        signal?.throwIfAborted();
        const limited = cooldownError(bucket, resource);
        if (limited) return Promise.reject(limited);
        if (bucket.active < maxConcurrency) {
            bucket.active++;
            return Promise.resolve();
        }
        if (bucket.queue.length >= maxQueue) return Promise.reject(new GitHubRateLimitError(1, 'GitHub request queue is full.'));
        return new Promise((resolve, reject) => {
            const entry = { resolve, reject, resource, signal };
            const remove = () => {
                const index = bucket.queue.indexOf(entry);
                if (index !== -1) bucket.queue.splice(index, 1);
                clearTimeout(entry.timer);
                signal?.removeEventListener('abort', entry.onAbort);
            };
            entry.cleanup = remove;
            entry.onAbort = () => { remove(); reject(signal.reason); };
            entry.timer = setTimeout(() => {
                remove();
                reject(new GitHubRateLimitError(1, 'GitHub request queue timed out.'));
            }, maxQueueWaitMs);
            signal?.addEventListener('abort', entry.onAbort, { once: true });
            bucket.queue.push(entry);
        });
    }

    function releaseLocal(bucket) {
        bucket.active--;
        while (bucket.queue.length && bucket.active < maxConcurrency) {
            const entry = bucket.queue[0];
            entry.cleanup();
            const limited = cooldownError(bucket, entry.resource);
            if (entry.signal?.aborted) entry.reject(entry.signal.reason);
            else if (limited) entry.reject(limited);
            else {
                bucket.active++;
                entry.resolve();
            }
        }
    }

    function getBucket(key) {
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = { active: 0, queue: [], cooldowns: new Map(), lookupCount: 0, lookupReset: 0 };
            buckets.set(key, bucket);
        }
        return bucket;
    }

    async function schedule(url, options = {}, performRequest) {
        const key = credentialKey(options);
        const resource = requestResource(url);
        const bucket = getBucket(key);
        await acquireLocal(bucket, resource, options.signal);
        let releaseLease;
        try {
            if (coordinator) releaseLease = await coordinator.acquire(key, resource);
            const signal = AbortSignal.any([
                AbortSignal.timeout(requestTimeoutMs), ...(options.signal ? [options.signal] : []),
            ]);
            const retry = retrySafe(url, options);
            for (let attempt = 0; ; attempt++) {
                signal.throwIfAborted();
                const limited = cooldownError(bucket, resource);
                if (limited) throw limited;
                if (attempt > 0 && coordinator) await coordinator.check(key, resource);
                let response;
                try {
                    response = await performRequest(signal);
                } catch (error) {
                    if (!retry || attempt > 0 || signal.aborted
                        || error instanceof GitHubRateLimitError || error instanceof GitHubSchedulerUnavailableError) throw error;
                    await sleep(100 + Math.floor(random() * 200), signal);
                    continue;
                }
                const observation = await rateLimitObservation(response, resource, now());
                if (observation) {
                    const until = Math.max(bucket.cooldowns.get(observation.resource) || 0, now() + observation.ms);
                    bucket.cooldowns.set(observation.resource, until);
                    if (coordinator) await coordinator.cooldown(key, observation.resource, until - now());
                    if (observation.throttled) {
                        await response.body?.cancel();
                        throw new GitHubRateLimitError(observation.ms / 1000);
                    }
                }
                if (retry && attempt === 0 && [502, 503, 504].includes(response.status) && !observation) {
                    await response.body?.cancel();
                    await sleep(100 + Math.floor(random() * 200), signal);
                    continue;
                }
                // fetch resolves at headers; retain the lease until the full response
                // has arrived so a slow body cannot bypass the concurrency bound.
                await response.clone().arrayBuffer();
                return response;
            }
        } finally {
            if (releaseLease) await releaseLease();
            releaseLocal(bucket);
        }
    }

    // Invoke inside the user cache loader, not on cache hits or every page visit.
    // One credential-wide budget prevents unique usernames bypassing the cache.
    schedule.admitLookup = async (options = {}) => {
        options.signal?.throwIfAborted();
        const key = credentialKey(options);
        if (coordinator) return coordinator.admitLookup(key, maxLookupsPerWindow, lookupWindowMs);
        const bucket = getBucket(key);
        if (bucket.lookupReset <= now()) {
            bucket.lookupCount = 0;
            bucket.lookupReset = now() + lookupWindowMs;
        }
        if (bucket.lookupCount >= maxLookupsPerWindow) {
            throw new GitHubRateLimitError((bucket.lookupReset - now()) / 1000, 'GitHub profile lookups are temporarily limited.');
        }
        bucket.lookupCount++;
    };
    return schedule;
}

export const scheduleGitHubRequest = createGitHubScheduler();
export const admitGitHubLookup = scheduleGitHubRequest.admitLookup;
