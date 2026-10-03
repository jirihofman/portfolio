import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

// Exercise Next's real stale-cache behavior with an in-memory storage backend.
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { unstable_cache } = await import('next/cache.js');
const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
const source = await readFile(new URL('../app/data.js', import.meta.url), 'utf8');
const config = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));

async function harness(fetch) {
    const entries = new Map();
    const context = vm.createContext({
        fetch, Headers, URL, AbortSignal, structuredClone, process: { env: {} },
        console: { log() {}, error() {} },
    });
    const module = new vm.SourceTextModule(source, { context });
    await module.link((specifier) => {
        const exports = specifier === 'next/cache'
            ? { unstable_cache } : { default: config };
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        }, { context });
    });
    await module.evaluate();
    const incrementalCache = {
        generateSimpleCacheKey: async (key) => key,
        get: async (key) => entries.get(key),
        set: async (key, value) => entries.set(key, { value, isStale: false }),
    };
    return {
        data: module.namespace,
        entries,
        async run(callback) {
            const store = { incrementalCache, isStaticGeneration: true };
            return workAsyncStorage.run(store, async () => {
                const result = await callback(module.namespace);
                await Promise.all(Object.values(store.pendingRevalidates || {}));
                return result;
            });
        },
    };
}

const repo = { name: 'demo', full_name: 'octocat/demo', owner: { login: 'octocat' } };
const json = (value, options) => Response.json(value, options);

for (const [name, response] of [
    ['timeout', () => { throw new DOMException('Timed out', 'TimeoutError'); }],
    ['rate limit', () => json({ message: 'Rate limited' }, { status: 403 })],
    ['server error', () => json({}, { status: 502 })],
    ['invalid JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } })],
    ['non-JSON response', () => new Response('<html>error</html>')],
    ['unexpected payload', () => json({ message: 'Unexpected' })],
]) {
    test(`${name} is rejected, not cached as an empty list`, async () => {
        const h = await harness(response);
        await assert.rejects(h.run((data) => data.getRepos('octocat')));
        assert.equal(h.entries.size, 0);
    });
}

test('a failed later page does not cache partial repositories', async () => {
    const h = await harness((url) => {
        if (new URL(url).searchParams.get('page') === '2') throw new Error('timeout');
        return json([repo], { headers: { link: '<https://api.github.com/users/octocat/repos?page=2>; rel="next"' } });
    });
    await assert.rejects(h.run((data) => data.getRepos('octocat')));
    assert.equal(h.entries.size, 0);
});

test('successful pagination and genuinely empty lists are cacheable', async () => {
    const h = await harness((url) => new URL(url).searchParams.get('page') === '2'
        ? json([{ ...repo, name: 'second' }])
        : json([repo], { headers: { link: '<https://api.github.com/users/octocat/repos?page=2>; rel="next"' } }));
    assert.equal((await h.run((data) => data.getRepos('octocat'))).length, 2);
    assert.equal(h.entries.size, 1);
    const empty = await harness(() => json([]));
    assert.equal((await empty.run((data) => data.getRepos('octocat'))).length, 0);
    assert.equal(empty.entries.size, 1);
});

test('failed revalidation retains the successful list and later recovers', async () => {
    let fail = false;
    let repositories = [repo];
    const h = await harness(() => {
        if (fail) throw new Error('timeout');
        return json(repositories);
    });
    await h.run((data) => data.getRepos('octocat'));
    const entry = [...h.entries.values()][0];
    entry.isStale = true;
    fail = true;
    const previousError = console.error;
    console.error = () => {};
    try {
        const stale = await h.run((data) => data.getRepos('octocat'));
        assert.equal(stale[0].name, 'demo');
        assert.equal([...h.entries.values()][0], entry);
    } finally {
        console.error = previousError;
    }
    fail = false;
    repositories = [{ ...repo, name: 'updated' }];
    const recovered = await h.run((data) => data.getRepos('octocat'));
    assert.equal(recovered[0].name, 'updated');
    assert.equal([...h.entries.values()][0].isStale, false);
});

test('cold-cache repository failures reach the page and secondary endpoint', async () => {
    const h = await harness(() => { throw new Error('timeout'); });
    await assert.rejects(h.run((data) => data.getProjectsPageData('octocat')));
    await assert.rejects(h.run((data) => data.getOwnerProjectSecondaryData()));
});

test('optional pinned-repository failure does not hide projects', async () => {
    const h = await harness((url) => {
        if (url.endsWith('/graphql')) throw new Error('timeout');
        return json([repo]);
    });
    const result = await h.run((data) => data.getProjectsPageData('octocat'));
    assert.equal(result.sorted[0].name, 'demo');
});
