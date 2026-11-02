import assert from 'node:assert/strict';
import { test } from 'node:test';
import { singleFlight, normalizeGitHubArguments } from '../lib/single-flight.mjs';

test('case variants share one in-flight call, but settled work is left to the data cache', async () => {
    let calls = 0;
    const load = singleFlight(async (name) => { calls++; return name; }, normalizeGitHubArguments);
    assert.deepEqual(await Promise.all([load('Octocat'), load('octocat'), load(' OCTOCAT ')]),
        ['octocat', 'octocat', 'octocat']);
    assert.equal(calls, 1);
    await load('octocat');
    assert.equal(calls, 2);
});

test('failed work is shared once, cleared, and can recover', async () => {
    let calls = 0;
    const load = singleFlight(async () => { if (++calls === 1) throw new Error('offline'); return 42; });
    const results = await Promise.allSettled([load('one'), load('one')]);
    assert.ok(results.every((result) => result.status === 'rejected'));
    assert.equal(calls, 1);
    assert.equal(await load('one'), 42);
});

test('different arguments remain independent', async () => {
    let calls = 0;
    const load = singleFlight(async (name) => { calls++; return name; });
    await Promise.all([load('one'), load('two')]);
    assert.equal(calls, 2);
});
