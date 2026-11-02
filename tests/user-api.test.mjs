import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../pages/api/users/[username].js', import.meta.url), 'utf8');
async function handler(getUser) {
    const context = vm.createContext({});
    const module = new vm.SourceTextModule(source, { context });
    await module.link((specifier) => {
        const values = specifier.endsWith('/data') ? { getUser } : {
            isValidGitHubUsername: (name) => typeof name === 'string' && /^[a-z\d-]+$/i.test(name),
        };
        return new vm.SyntheticModule(Object.keys(values), function () {
            for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }, { context });
    });
    await module.evaluate();
    return module.namespace.default;
}
function response() {
    return { headers: {}, setHeader(key, value) { this.headers[key] = value; },
        status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
}

test('lookup endpoint uses the shared profile service and exposes only its ID', async () => {
    const run = await handler(async (username) => {
        assert.equal(username, 'Octocat');
        return { id: 1, login: 'octocat', email: 'not-returned@example.test' };
    });
    const res = await run({ method: 'GET', query: { username: 'Octocat' } }, response());
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.stringify(res.body), '{"id":1}');
});

test('only genuine absence becomes a briefly cacheable 404', async () => {
    const run = await handler(async () => null);
    const res = await run({ method: 'GET', query: { username: 'missing' } }, response());
    assert.equal(res.statusCode, 404);
    assert.match(res.headers['Cache-Control'], /s-maxage=60/);
});

test('throttling and outages are uncached and propagate retry hints', async () => {
    for (const status of [429, 503, 502]) {
        const run = await handler(async () => { throw Object.assign(new Error('upstream'), { status, retryAfter: 30 }); });
        const res = await run({ method: 'GET', query: { username: 'octocat' } }, response());
        assert.equal(res.statusCode, status);
        assert.equal(res.headers['Cache-Control'], 'no-store');
        assert.equal(res.headers['Retry-After'], '30');
    }
});

test('invalid inputs and unsupported methods never perform a lookup', async () => {
    const run = await handler(async () => { throw new Error('must not run'); });
    assert.equal((await run({ method: 'POST', query: { username: 'octocat' } }, response())).statusCode, 405);
    assert.equal((await run({ method: 'GET', query: { username: ['one', 'two'] } }, response())).statusCode, 400);
});
