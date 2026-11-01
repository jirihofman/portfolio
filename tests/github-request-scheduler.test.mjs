import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createGitHubScheduler,
    GitHubRateLimitError,
    GitHubSchedulerUnavailableError,
} from '../lib/github-request-scheduler.mjs';

const coreUrl = 'https://api.github.com/users/octocat';
const searchUrl = 'https://api.github.com/search/commits?q=example';
const graphqlUrl = 'https://api.github.com/graphql';
const options = { headers: { Authorization: 'Bearer test-token' } };
const graphqlOptions = { ...options, method: 'POST', body: JSON.stringify({ query: 'query { viewer { login } }' }) };
const json = (value = {}, init) => Response.json(value, init);
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
};
const create = (config = {}) => createGitHubScheduler({ redis: null, sleep: async () => {}, ...config });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('all REST and GraphQL reads share a credential concurrency bound', async () => {
    const schedule = create({ maxConcurrency: 2 });
    const gate = deferred();
    let active = 0;
    let peak = 0;
    let calls = 0;
    const perform = async (signal) => {
        assert.ok(signal instanceof AbortSignal);
        calls++;
        peak = Math.max(peak, ++active);
        await gate.promise;
        active--;
        return json();
    };
    const results = [
        schedule(coreUrl, options, perform),
        schedule(graphqlUrl, graphqlOptions, perform),
        schedule(searchUrl, options, perform),
        schedule(coreUrl, options, perform),
    ];
    await tick();
    assert.equal(calls, 2);
    gate.resolve();
    await Promise.all(results);
    assert.equal(calls, 4);
    assert.equal(peak, 2);
});

test('queue overflow, cancellation, and queue deadlines do not leak capacity', async () => {
    const schedule = create({ maxConcurrency: 1, maxQueue: 1, maxQueueWaitMs: 20 });
    const gate = deferred();
    const first = schedule(coreUrl, options, async () => { await gate.promise; return json(); });
    const controller = new AbortController();
    const queued = schedule(coreUrl, { ...options, signal: controller.signal }, async () => json());
    await assert.rejects(schedule(coreUrl, options, async () => json()), /queue is full/);
    controller.abort();
    await assert.rejects(queued, { name: 'AbortError' });
    await assert.rejects(schedule(coreUrl, options, async () => json()), /queue timed out/);
    gate.resolve();
    await first;
    assert.equal((await schedule(coreUrl, options, async () => json())).status, 200);
});

test('a failed operation releases its slot and retries a read only once', async () => {
    const schedule = create({ maxConcurrency: 1 });
    let calls = 0;
    await assert.rejects(schedule(coreUrl, options, async () => { calls++; throw new Error('offline'); }), /offline/);
    assert.equal(calls, 2);
    assert.equal((await schedule(coreUrl, options, async () => json())).status, 200);
});

test('a transient server error retries once with jitter and permission failures do not retry', async () => {
    const waits = [];
    const schedule = create({ random: () => 0.5, sleep: async (ms) => waits.push(ms) });
    let calls = 0;
    const response = await schedule(coreUrl, options, async () => ++calls === 1 ? json({}, { status: 502 }) : json({ id: 1 }));
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.deepEqual(waits, [200]);
    for (const status of [403, 404]) {
        calls = 0;
        assert.equal((await schedule(coreUrl, options, async () => {
            calls++;
            return json({ message: 'Not accessible' }, { status });
        })).status, status);
        assert.equal(calls, 1);
    }
});

test('mutations are never automatically retried', async () => {
    const schedule = create();
    let calls = 0;
    const response = await schedule(graphqlUrl, { ...graphqlOptions, body: JSON.stringify({ query: 'mutation { example }' }) }, async () => {
        calls++;
        return json({}, { status: 503 });
    });
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
});

test('primary exhaustion pauses only the affected credential and resource', async () => {
    let now = 1_000;
    const schedule = create({ now: () => now });
    let calls = 0;
    await assert.rejects(schedule(searchUrl, options, async () => {
        calls++;
        return json({ message: 'API rate limit exceeded' }, {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '31', 'x-ratelimit-resource': 'search' },
        });
    }), (error) => error instanceof GitHubRateLimitError && error.retryAfter === 30);
    await assert.rejects(schedule(searchUrl, options, async () => { calls++; return json(); }), GitHubRateLimitError);
    assert.equal(calls, 1);
    assert.equal((await schedule(coreUrl, options, async () => json())).status, 200);
    assert.equal((await schedule(searchUrl, { headers: { Authorization: 'Bearer another-token' } }, async () => json())).status, 200);
    now = 31_001;
    assert.equal((await schedule(searchUrl, options, async () => json())).status, 200);
});

test('successful responses with no remaining budget are returned before pausing subsequent reads', async () => {
    const schedule = create({ now: () => 1_000 });
    const response = await schedule(coreUrl, options, async () => json({ id: 1 }, {
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '31', 'x-ratelimit-resource': 'core' },
    }));
    assert.equal((await response.json()).id, 1);
    await assert.rejects(schedule(coreUrl, options, async () => json()), GitHubRateLimitError);
});

test('secondary limits pause REST and GraphQL together and respect Retry-After', async () => {
    const schedule = create({ now: () => 1_000 });
    await assert.rejects(schedule(coreUrl, options, async () => json({ message: 'secondary rate limit' }, {
        status: 403, headers: { 'retry-after': '75' },
    })), (error) => error.retryAfter === 75);
    await assert.rejects(schedule(graphqlUrl, graphqlOptions, async () => json()), (error) => error.retryAfter === 75);
});

test('GraphQL HTTP-200 rate errors are rejected and default to a one-minute cooldown', async () => {
    const schedule = create({ now: () => 1_000 });
    await assert.rejects(schedule(graphqlUrl, graphqlOptions, async () => json({
        errors: [{ type: 'RATE_LIMITED', message: 'Please try later' }],
    })), (error) => error instanceof GitHubRateLimitError && error.retryAfter === 60);
    await assert.rejects(schedule(coreUrl, options, async () => json()), GitHubRateLimitError);
});

test('non-rate GraphQL errors pass through without retry or a cooldown', async () => {
    const schedule = create();
    const response = await schedule(graphqlUrl, graphqlOptions, async () => json({ errors: [{ message: 'Not found' }] }));
    assert.equal((await response.json()).errors[0].message, 'Not found');
    assert.equal((await schedule(graphqlUrl, graphqlOptions, async () => json())).status, 200);
});

test('queued work observes a cooldown established by the preceding request', async () => {
    const schedule = create({ maxConcurrency: 1 });
    const gate = deferred();
    const limited = schedule(coreUrl, options, async () => {
        await gate.promise;
        return json({}, { status: 429, headers: { 'retry-after': '2' } });
    });
    let ran = false;
    const queued = schedule(coreUrl, options, async () => { ran = true; return json(); });
    const results = Promise.allSettled([limited, queued]);
    gate.resolve();
    assert.deepEqual((await results).map((result) => result.status), ['rejected', 'rejected']);
    assert.equal(ran, false);
});

test('an in-flight retry stops when another worker establishes a cooldown', async () => {
    const wait = deferred();
    const sleeping = deferred();
    const schedule = create({ sleep: async () => { sleeping.resolve(); await wait.promise; } });
    let calls = 0;
    const retrying = schedule(coreUrl, options, async () => { calls++; return json({}, { status: 502 }); });
    await sleeping.promise;
    await assert.rejects(schedule(coreUrl, options, async () => json({}, {
        status: 429, headers: { 'retry-after': '10' },
    })), GitHubRateLimitError);
    const rejected = assert.rejects(retrying, GitHubRateLimitError);
    wait.resolve();
    await rejected;
    assert.equal(calls, 1);
});

test('a slow response body retains its concurrency slot until it finishes', async () => {
    const schedule = create({ maxConcurrency: 1 });
    let body;
    const stream = new ReadableStream({ start(controller) { body = controller; } });
    const first = schedule(coreUrl, options, async () => new Response(stream));
    let secondRan = false;
    const second = schedule(coreUrl, options, async () => { secondRan = true; return json(); });
    await tick();
    assert.equal(secondRan, false);
    body.enqueue(new TextEncoder().encode('{}'));
    body.close();
    await Promise.all([first, second]);
    assert.equal(secondRan, true);
});

test('caller aborts reach the underlying request and never retry', async () => {
    const schedule = create();
    const controller = new AbortController();
    let calls = 0;
    const request = schedule(coreUrl, { ...options, signal: controller.signal }, (signal) => {
        calls++;
        return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    });
    await tick();
    controller.abort();
    await assert.rejects(request, { name: 'AbortError' });
    assert.equal(calls, 1);
});

// Simulate Redis's atomic command boundary, sharing storage across independent
// scheduler instances. Assert that admission/cooldown updates are Lua EVALs,
// rather than separate read/write requests that would race in production.
function fakeRedis() {
    const leases = new Map();
    const cooldowns = new Map();
    const lookups = new Map();
    const commands = [];
    let time = 1_000;
    return {
        commands,
        advance(ms) { time += ms; },
        async fetch(url, options) {
            assert.equal(url, 'https://redis.example.test');
            assert.equal(options.cache, 'no-store');
            const command = JSON.parse(options.body);
            commands.push(command);
            let result;
            if (command[0] === 'EVAL' && command[2] === 3) {
                assert.match(command[1], /redis.call\('TIME'\)/);
                assert.match(command[1], /ZREMRANGEBYSCORE/);
                assert.match(command[1], /ZCARD/);
                assert.match(command[1], /ZADD/);
                const [, , , key, resourceKey, globalKey, maximum, leaseMs, id] = command;
                const entries = leases.get(key) || new Map();
                for (const [leaseId, until] of entries) if (until <= time) entries.delete(leaseId);
                const cooldown = Math.max(cooldowns.get(resourceKey) || 0, cooldowns.get(globalKey) || 0) - time;
                if (cooldown > 0) result = [0, cooldown];
                else if (entries.size >= maximum) result = [0, Math.min(...entries.values()) - time];
                else {
                    entries.set(id, time + leaseMs);
                    leases.set(key, entries);
                    result = [1, 0];
                }
            } else if (command[0] === 'EVAL' && command[2] === 2) {
                result = Math.max(0, (cooldowns.get(command[3]) || 0) - time, (cooldowns.get(command[4]) || 0) - time);
            } else if (command[0] === 'EVAL' && command[1].includes("redis.call('INCR'")) {
                const [, , , key, maximum, windowMs] = command;
                let entry = lookups.get(key);
                if (!entry || entry.until <= time) {
                    entry = { count: 0, until: time + windowMs };
                    lookups.set(key, entry);
                }
                if (entry.count >= maximum) result = entry.until - time;
                else { entry.count++; result = 0; }
            } else if (command[0] === 'EVAL' && command[2] === 1) {
                assert.match(command[1], /remaining < tonumber/);
                const [, , , key, ms] = command;
                cooldowns.set(key, Math.max(cooldowns.get(key) || 0, time + ms));
                result = 1;
            } else if (command[0] === 'ZREM') {
                result = leases.get(command[1])?.delete(command[2]) ? 1 : 0;
            } else assert.fail(`Unexpected command ${command[0]}`);
            return json({ result });
        },
    };
}

test('independent instances share Redis admission and cooldowns without exposing credentials in keys', async () => {
    const redis = fakeRedis();
    const config = { redis: { url: 'https://redis.example.test', token: 'redis-secret' }, fetch: redis.fetch, maxConcurrency: 1 };
    const firstInstance = create(config);
    const secondInstance = create(config);
    const gate = deferred();
    const first = firstInstance(coreUrl, options, async () => { await gate.promise; return json(); });
    await tick();
    let secondRan = false;
    await assert.rejects(secondInstance(coreUrl, options, async () => { secondRan = true; return json(); }), GitHubRateLimitError);
    assert.equal(secondRan, false);
    gate.resolve();
    await first;
    await assert.rejects(firstInstance(coreUrl, options, async () => json({}, {
        status: 429, headers: { 'retry-after': '10' },
    })), GitHubRateLimitError);
    await assert.rejects(secondInstance(graphqlUrl, graphqlOptions, async () => json()), (error) => error.retryAfter === 10);
    redis.advance(10_001);
    assert.equal((await secondInstance(coreUrl, options, async () => json())).status, 200);
    assert.doesNotMatch(JSON.stringify(redis.commands), /test-token|redis-secret/);
});

test('Redis failure and partial configuration fail closed with a sanitized error', async () => {
    for (const redis of [{ url: 'https://redis.example.test', token: 'secret' }, { url: 'https://redis.example.test' }]) {
        let ran = false;
        const schedule = create({ redis, fetch: async () => { throw new Error('secret provider detail'); } });
        await assert.rejects(schedule(coreUrl, options, async () => { ran = true; return json(); }), (error) => {
            assert.ok(error instanceof GitHubSchedulerUnavailableError);
            assert.doesNotMatch(error.message, /secret|redis\.example/);
            return true;
        });
        assert.equal(ran, false);
    }
});

test('Redis leases are released when GitHub fails and expire after a lost release', async () => {
    const redis = fakeRedis();
    const config = { redis: { url: 'https://redis.example.test', token: 'secret' }, fetch: redis.fetch, maxConcurrency: 1 };
    const first = create(config);
    await assert.rejects(first(coreUrl, options, async () => { throw new Error('network'); }), /network/);
    const second = create(config);
    assert.equal((await second(coreUrl, options, async () => json())).status, 200);
    const lostRelease = create({ ...config, fetch: async (url, options) => {
        if (JSON.parse(options.body)[0] === 'ZREM') throw new Error('offline');
        return redis.fetch(url, options);
    } });
    await lostRelease(coreUrl, options, async () => json());
    await assert.rejects(second(coreUrl, options, async () => json()), GitHubRateLimitError);
    redis.advance(17_001);
    assert.equal((await second(coreUrl, options, async () => json())).status, 200);
});

test('cold profile lookup admission is credential scoped and resets after its window', async () => {
    let now = 1_000;
    const schedule = create({ now: () => now, maxLookupsPerWindow: 2, lookupWindowMs: 60_000 });
    await schedule.admitLookup(options);
    await schedule.admitLookup(options);
    await assert.rejects(schedule.admitLookup(options), (error) => error.retryAfter === 60);
    await schedule.admitLookup({ headers: { Authorization: 'Bearer independent-token' } });
    // Admission does not prevent requests for cached profiles' other data.
    assert.equal((await schedule(coreUrl, options, async () => json())).status, 200);
    now = 61_001;
    await schedule.admitLookup(options);
});

test('profile lookup admission is atomic and shared across Redis-backed instances', async () => {
    const redis = fakeRedis();
    const config = {
        redis: { url: 'https://redis.example.test', token: 'secret' }, fetch: redis.fetch,
        maxLookupsPerWindow: 2, lookupWindowMs: 60_000,
    };
    const first = create(config);
    const second = create(config);
    const results = await Promise.allSettled([
        first.admitLookup(options), second.admitLookup(options), first.admitLookup(options), second.admitLookup(options),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 2);
    assert.ok(results.filter((result) => result.status === 'rejected').every((result) => result.reason.retryAfter === 60));
    redis.advance(60_001);
    await second.admitLookup(options);
});

test('profile lookup admission fails closed if Redis is unavailable', async () => {
    const schedule = create({
        redis: { url: 'https://redis.example.test', token: 'secret' },
        fetch: async () => { throw new Error('offline'); },
    });
    await assert.rejects(schedule.admitLookup(options), GitHubSchedulerUnavailableError);
});
