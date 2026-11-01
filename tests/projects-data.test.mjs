import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

// Exercise Next's real stale-cache behavior with an in-memory storage backend.
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { unstable_cache } = await import('next/cache.js');
const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
const appDataUrl = new URL('../app/data.js', import.meta.url);
const source = await readFile(appDataUrl, 'utf8');
const config = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
let harnessId = 0;

async function harness(fetch, env = {}) {
    const entries = new Map();
    const context = vm.createContext({
        fetch, Headers, URL, AbortSignal, structuredClone,
        process: { env: { GH_TOKEN: `cache-test-token-${++harnessId}`, ...env } },
        console: { log() {}, error() {} },
    });
    const module = new vm.SourceTextModule(source, { context });
    await module.link(async (specifier) => {
        const exports = specifier === 'next/cache'
            ? { unstable_cache }
            : specifier === '../data.json'
                ? { default: config }
                : await import(new URL(specifier, appDataUrl));
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
    // The request triggering revalidation may still receive the stale result.
    // run() waits for the refresh; the next read must see the recovered data.
    await h.run((data) => data.getRepos('octocat'));
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

const toPlain = (value) => JSON.parse(JSON.stringify(value));
const gql = (data) => json({ data });

const cacheCases = [
    {
        name: 'user profile',
        read: (data) => data.getUser('octocat'),
        success: () => json({ id: 1, login: 'octocat', name: 'Octocat' }),
    },
    {
        name: 'pinned repositories',
        read: (data) => data.getPinnedRepos('octocat'),
        success: () => gql({ user: { pinnedItems: { nodes: [{ name: 'demo' }] } } }),
    },
    {
        name: 'repository content',
        read: (data) => data.getRepositoryPackageJson('octocat', 'demo'),
        success: () => gql({ repository: { packageJson: { text: '{"name":"demo"}' } } }),
    },
    {
        name: 'traffic',
        read: (data) => data.getTrafficPageViews('octocat', 'demo'),
        success: () => json({ uniques: 12, views: [] }),
    },
    {
        name: 'Dependabot alerts',
        read: (data) => data.getDependabotAlerts('octocat', 'demo'),
        success: () => json([{ state: 'open', security_advisory: { severity: 'high' } }]),
    },
    {
        name: 'Codex coauthored commits',
        read: (data) => data.getCodexCoauthoredCommitsAccountWide('octocat'),
        success: () => json({ total_count: 7 }),
    },
    {
        name: 'Claude coauthored commits',
        read: (data) => data.getClaudeCoauthoredCommitsAccountWide('octocat'),
        success: () => json({ total_count: 4 }),
    },
];

for (const cacheCase of cacheCases) {
    test(`${cacheCase.name}: cold upstream failures do not create a fallback cache entry`, async () => {
        const h = await harness(() => json({ message: 'Temporarily unavailable' }, { status: 502 }));
        await assert.rejects(h.run(cacheCase.read));
        assert.equal(h.entries.size, 0);
    });

    test(`${cacheCase.name}: failed refresh keeps the previous successful value`, async () => {
        let fail = false;
        const h = await harness(() => fail
            ? json({ message: 'Rate limited' }, { status: 403 })
            : cacheCase.success());
        const initial = toPlain(await h.run(cacheCase.read));
        const savedEntries = [...h.entries.entries()];
        assert.ok(savedEntries.length > 0);
        for (const [, entry] of savedEntries) entry.isStale = true;
        fail = true;
        const previousError = console.error;
        console.error = () => {};
        try {
            assert.deepEqual(toPlain(await h.run(cacheCase.read)), initial);
        } finally {
            console.error = previousError;
        }
        for (const [key, entry] of savedEntries) {
            assert.equal(h.entries.get(key), entry, 'failed refresh must not replace the cache entry');
            assert.equal(entry.isStale, true);
        }
    });
}

test('only a genuine profile 404 is cached as a missing user', async () => {
    let calls = 0;
    const missing = await harness(() => {
        calls++;
        return json({ message: 'Not Found' }, { status: 404 });
    });
    assert.equal(await missing.run((data) => data.getUser('missing-user')), null);
    assert.equal(await missing.run((data) => data.getUser('missing-user')), null);
    assert.equal(calls, 1);
    assert.equal(missing.entries.size, 1);

    for (const status of [403, 429, 502]) {
        const unavailable = await harness(() => json({ message: 'Unavailable' }, { status }));
        await assert.rejects(unavailable.run((data) => data.getUser('octocat')));
        assert.equal(unavailable.entries.size, 0);
    }
});

test('invalid profile JSON and malformed successful profiles are not cached', async () => {
    for (const response of [
        () => new Response('{', { headers: { 'content-type': 'application/json' } }),
        () => json({ message: 'not a profile' }),
    ]) {
        const h = await harness(response);
        await assert.rejects(h.run((data) => data.getUser('octocat')));
        assert.equal(h.entries.size, 0);
    }
});

test('GraphQL HTTP-200 errors do not cache empty or partial pinned results', async () => {
    const h = await harness(() => json({
        data: { user: { pinnedItems: { nodes: [{ name: 'partial' }] } } },
        errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
    }));
    await assert.rejects(h.run((data) => data.getPinnedRepos('octocat')));
    assert.equal(h.entries.size, 0);
});

test('a failure on a later release-summary page cannot cache a partial total', async () => {
    const h = await harness((url, options) => {
        const { variables } = JSON.parse(options.body);
        if (variables.after) {
            return json({ errors: [{ message: 'Upstream timeout' }] });
        }
        return gql({ user: { repositories: {
            nodes: [{ releases: { totalCount: 9 } }],
            pageInfo: { hasNextPage: true, endCursor: 'next-page' },
        } } });
    });
    await assert.rejects(h.run((data) => data.getPublishedReleaseSummary('octocat')));
    assert.equal(h.entries.size, 0);
});

test('genuine empty and absent optional data remain cacheable', async () => {
    const cases = [
        {
            read: (data) => data.getPinnedRepos('octocat'),
            response: () => gql({ user: { pinnedItems: { nodes: [] } } }),
            expected: [],
        },
        {
            read: (data) => data.getRepositoryPackageJson('octocat', 'demo'),
            response: () => gql({ repository: { packageJson: null } }),
            expected: null,
        },
        {
            read: (data) => data.getDependabotAlerts('octocat', 'demo'),
            response: () => json([]),
            expected: {},
        },
        {
            read: (data) => data.getCodexCoauthoredCommitsAccountWide('octocat'),
            response: () => json({ total_count: 0 }),
            expected: 0,
        },
    ];
    for (const cacheCase of cases) {
        let calls = 0;
        const h = await harness(() => {
            calls++;
            return cacheCase.response();
        });
        assert.deepEqual(toPlain(await h.run(cacheCase.read)), cacheCase.expected);
        assert.deepEqual(toPlain(await h.run(cacheCase.read)), cacheCase.expected);
        assert.equal(calls, 1);
    }
});

test('a Vercel outage preserves previously cached project links', async () => {
    let fail = false;
    const h = await harness(() => fail
        ? json({}, { status: 503 })
        : json({ projects: [{ id: 'project-1', name: 'demo' }] }), { VC_TOKEN: 'test-vercel-token' });
    const initial = toPlain(await h.run((data) => data.getVercelProjects()));
    const entry = [...h.entries.values()][0];
    entry.isStale = true;
    fail = true;
    const previousError = console.error;
    console.error = () => {};
    try {
        assert.deepEqual(toPlain(await h.run((data) => data.getVercelProjects())), initial);
    } finally {
        console.error = previousError;
    }
    assert.equal([...h.entries.values()][0], entry);
});
