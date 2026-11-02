import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConditionalGitHubRequest } from '../lib/github-conditional-request.mjs';

const url = 'https://api.github.com/users/octocat/repos?per_page=100';
const init = { headers: { Authorization: 'Bearer test-token', Accept: 'application/vnd.github+json' } };
const json = (value, etag = '"v1"', headers = {}) => Response.json(value, { headers: { etag, ...headers } });

test('authenticated 304 reuses JSON and pagination while keeping live rate headers', async () => {
    const request = createConditionalGitHubRequest();
    const link = '<https://api.github.com/users/octocat/repos?page=2>; rel="next"';
    const first = await request(url, init, async () => json([{ name: 'one' }], '"v1"', {
        link, 'x-ratelimit-remaining': '100', 'content-encoding': 'gzip',
    }));
    assert.deepEqual(await first.json(), [{ name: 'one' }]);

    const reused = await request(url, init, async (_, options) => {
        assert.equal(options.headers.get('if-none-match'), '"v1"');
        return new Response(null, { status: 304, headers: { 'x-ratelimit-remaining': '99' } });
    });
    assert.equal(reused.status, 200);
    assert.deepEqual(await reused.json(), [{ name: 'one' }]);
    assert.equal(reused.headers.get('link'), link);
    assert.equal(reused.headers.get('x-ratelimit-remaining'), '99');
    assert.equal(reused.headers.get('content-encoding'), null);
    assert.equal(init.headers['If-None-Match'], undefined);
});

test('new successful body and validator replace the previous representation', async () => {
    const request = createConditionalGitHubRequest();
    await request(url, init, async () => json({ version: 1 }));
    await request(url, init, async () => json({ version: 2 }, '"v2"'));
    const result = await request(url, init, async (_, options) => {
        assert.equal(options.headers.get('if-none-match'), '"v2"');
        return new Response(null, { status: 304 });
    });
    assert.deepEqual(await result.json(), { version: 2 });
});

test('cache identity isolates credentials, media types, API versions and URLs', async () => {
    const request = createConditionalGitHubRequest();
    await request(url, init, async () => json({ privateValue: 1 }));
    for (const [candidateUrl, candidateInit] of [
        [url, { headers: { ...init.headers, Authorization: 'Bearer different-token' } }],
        [url, { headers: { ...init.headers, Accept: 'application/json' } }],
        [url, { headers: { ...init.headers, 'X-GitHub-Api-Version': '2022-11-28' } }],
        [`${url}&page=2`, init],
    ]) {
        await request(candidateUrl, candidateInit, async (_, options) => {
            assert.equal(options.headers.get('if-none-match'), null);
            return json({ publicValue: 2 });
        });
    }
});

test('only authenticated full GET requests to api.github.com use validators', async () => {
    const request = createConditionalGitHubRequest();
    for (const [candidateUrl, candidateInit] of [
        [url, {}],
        [url, { ...init, method: 'POST' }],
        [url, { ...init, method: 'HEAD' }],
        [url, { headers: { ...init.headers, Range: 'bytes=0-10' } }],
        ['https://other.example.com/data', init],
        ['http://api.github.com/users/octocat', init],
    ]) {
        for (let attempt = 0; attempt < 2; attempt++) {
            await request(candidateUrl, candidateInit, async (_, options) => {
                assert.equal(new Headers(options.headers).get('if-none-match'), null);
                return json({ value: 1 });
            });
        }
    }
});

test('LRU eviction bounds stored representations', async () => {
    const request = createConditionalGitHubRequest({ maxEntries: 2 });
    const urls = ['a', 'b', 'c'].map(name => `https://api.github.com/users/${name}`);
    for (const candidate of urls.slice(0, 2)) await request(candidate, init, async () => json({}));
    await request(urls[0], init, async () => new Response(null, { status: 304 }));
    await request(urls[2], init, async () => json({}));
    await request(urls[1], init, async (_, options) => {
        assert.equal(options.headers.get('if-none-match'), null);
        return json({});
    });
});

test('oversized response bodies are returned intact but not retained', async () => {
    const request = createConditionalGitHubRequest({ maxBodyBytes: 8 });
    const value = { large: 'this exceeds eight bytes' };
    const result = await request(url, init, async () => json(value));
    assert.deepEqual(await result.json(), value);
    await request(url, init, async (_, options) => {
        assert.equal(options.headers.get('if-none-match'), null);
        return json(value);
    });
});

test('transient errors and malformed JSON never replace a good representation', async () => {
    const request = createConditionalGitHubRequest();
    await request(url, init, async () => json({ good: true }));
    const error = await request(url, init, async () => Response.json({}, { status: 502 }));
    assert.equal(error.status, 502);
    const malformed = await request(url, init, async () => new Response('{', {
        headers: { 'content-type': 'application/json', etag: '"bad"' },
    }));
    assert.equal(await malformed.text(), '{');
    const reused = await request(url, init, async (_, options) => {
        assert.equal(options.headers.get('if-none-match'), '"v1"');
        return new Response(null, { status: 304 });
    });
    assert.deepEqual(await reused.json(), { good: true });
});

test('304 without a stored body retries once without any conditions', async () => {
    const request = createConditionalGitHubRequest();
    let attempts = 0;
    const result = await request(url, { headers: {
        ...init.headers, 'If-None-Match': '"external"', 'If-Modified-Since': 'yesterday',
    } }, async (_, options) => {
        attempts++;
        if (attempts === 1) return new Response(null, { status: 304 });
        assert.equal(options.headers.get('if-none-match'), null);
        assert.equal(options.headers.get('if-modified-since'), null);
        return json({ recovered: true });
    });
    assert.equal(attempts, 2);
    assert.deepEqual(await result.json(), { recovered: true });
});

test('repeated 304 without a body is rejected rather than returned as success', async () => {
    let attempts = 0;
    await assert.rejects(createConditionalGitHubRequest()(url, init, async () => {
        attempts++;
        return new Response(null, { status: 304 });
    }), /without a cached representation/);
    assert.equal(attempts, 2);
});
