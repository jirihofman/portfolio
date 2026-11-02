import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import { transformSync } from 'next/dist/build/swc/index.js';

const source = await readFile(new URL('../app/components/recent-activity.jsx', import.meta.url), 'utf8');
const { code } = transformSync(source, {
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'es6' },
});

async function renderCounts(counts) {
    const context = vm.createContext({});
    const data = {
        getOptionalValue: async (read, fallback) => { try { return await read(); } catch { return fallback; } },
        getRecentUserActivity: async () => [],
        getPublishedReleaseSummary: async () => null,
    };
    ['getCopilotPRsAccountWide', 'getCodexCoauthoredCommitsAccountWide', 'getCodexLabeledPRsAccountWide',
        'getClaudeCoauthoredCommitsAccountWide', 'getClaudeLabeledPRsAccountWide'].forEach((name, index) => {
        data[name] = async () => {
            if (counts[index] === null) throw new Error('Unavailable');
            return counts[index];
        };
    });
    const module = new vm.SourceTextModule(code, { context });
    await module.link((specifier) => {
        const exports = specifier === '../data' ? data
            : specifier === 'react/jsx-runtime' ? jsxRuntime
                : { SiGithubcopilot: () => null, SiClaude: () => null, CodexIcon: () => null };
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        }, { context });
    });
    await module.evaluate();
    return renderToStaticMarkup(await module.namespace.CopilotActivity({ username: 'octocat' }));
}

test('an unavailable contribution source leaves healthy agents visible', async () => {
    const html = await renderCounts([null, 2, 3, 4, 5]);
    assert.match(html, /5 contributions/);
    assert.match(html, /9 contributions/);
    assert.doesNotMatch(html, /Copilot|at least|NaN/);
});

test('partial agent counts display a lower bound without hiding other agents', async () => {
    const html = await renderCounts([2, null, 3, 4, null]);
    assert.match(html, /2 merged PRs/);
    assert.match(html, /at least 3 contributions/);
    assert.match(html, /at least 4 contributions/);
    assert.doesNotMatch(html, /NaN/);
});

test('empty and unavailable contribution counts do not render an empty summary', async () => {
    assert.equal(await renderCounts([null, null, null, null, null]), '');
    assert.equal(await renderCounts([0, 0, 0, 0, 0]), '');
});
