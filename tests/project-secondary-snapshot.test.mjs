import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectSecondarySnapshot } from '../lib/project-secondary-snapshot.mjs';

test('partial refresh preserves the previous snapshot and its original age', () => {
    const previous = { repositories: { demo: { views: 42 } }, cachedAt: 100 };
    const partial = { complete: false, repositories: { demo: { views: null } } };
    assert.equal(selectSecondarySnapshot(previous, partial, 200), previous);
    assert.equal(previous.cachedAt, 100);
});

test('cold partial data is displayable without becoming a persisted snapshot', () => {
    const partial = { complete: false, repositories: { demo: { views: null } } };
    const snapshot = selectSecondarySnapshot(null, partial, 200);
    assert.equal(snapshot, partial);
    assert.equal(snapshot.cachedAt, undefined);
});

test('a successful refresh replaces stale values and starts a new snapshot age', () => {
    const payload = { complete: true, schemaVersion: 1, generatedAt: '2026-01-01', repositories: { demo: { views: 0 } } };
    const snapshot = selectSecondarySnapshot({ cachedAt: 100 }, payload, 200);
    assert.equal(snapshot.repositories.demo.views, 0);
    assert.equal(snapshot.cachedAt, 200);
});
