import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../app/api/projects/secondary/route.js', import.meta.url), 'utf8');
async function route(load) {
    const context = vm.createContext({ URL, Response, console: { error() {} } });
    const mod = new vm.SourceTextModule(source, { context });
    await mod.link(() => new vm.SyntheticModule(['getOwnerProjectSecondaryData'], function () {
        this.setExport('getOwnerProjectSecondaryData', load);
    }, { context }));
    await mod.evaluate();
    return mod.namespace.GET;
}

test('only complete secondary payloads receive CDN freshness', async () => {
    for (const complete of [true, false]) {
        const get = await route(async () => ({ complete, repositories: { demo: {} } }));
        const response = await get(new Request('https://example.test/api/projects/secondary'));
        assert.equal(response.status, 200);
        assert.equal((await response.json()).complete, complete);
        assert.equal(response.headers.get('cache-control'), complete
            ? 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400' : 'no-store');
    }
});

test('critical secondary failures remain uncached 503 responses', async () => {
    const get = await route(async () => { throw new Error('offline'); });
    const response = await get(new Request('https://example.test/api/projects/secondary'));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
});
