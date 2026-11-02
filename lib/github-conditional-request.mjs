import { createHash } from 'node:crypto';

const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

function requestKey(url, init, headers) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    const authorization = headers.get('authorization')?.trim();
    if ((init.method || 'GET').toUpperCase() !== 'GET'
        || parsed.origin !== 'https://api.github.com'
        || parsed.username || parsed.password
        || !authorization || headers.has('range')) {
        return null;
    }

    parsed.hash = '';
    return JSON.stringify([
        'GET', parsed.href,
        headers.get('accept') || '',
        headers.get('x-github-api-version') || '',
        createHash('sha256').update(authorization).digest('hex'),
    ]);
}

async function readCacheableBody(response, maxBodyBytes) {
    if (response.status !== 200 || !response.headers.get('etag')) return null;
    const contentType = response.headers.get('content-type')?.split(';')[0].trim();
    if (!contentType || !/^application\/(?:json|[\w.+-]+\+json)$/i.test(contentType)) return null;
    if (Number(response.headers.get('content-length')) > maxBodyBytes) return null;

    const reader = response.clone().body?.getReader();
    if (!reader) return null;
    const chunks = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > maxBodyBytes) {
                // A cloned stream can wait for its other consumer when cancelling.
                // Do not block delivery of the original response on that consumer.
                reader.cancel().catch(() => {});
                return null;
            }
            chunks.push(value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        JSON.parse(body);
        return body;
    } catch {
        return null;
    } finally {
        reader.releaseLock();
    }
}

function representationHeaders(cachedHeaders, responseHeaders) {
    const headers = new Headers(cachedHeaders);
    for (const [name, value] of responseHeaders) headers.set(name, value);
    // The saved body is decoded JSON, not the original compressed wire bytes.
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    return headers;
}

/**
 * Keep bounded, process-local validators for authenticated GitHub REST reads.
 * This complements the persistent Next data cache; it does not replace it or
 * share validators across server instances. performRequest must apply rate-limit
 * controls to the original response, including 304, before returning it here.
 */
export function createConditionalGitHubRequest({
    maxEntries = DEFAULT_MAX_ENTRIES,
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
} = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 0
        || !Number.isInteger(maxBodyBytes) || maxBodyBytes < 1) {
        throw new RangeError('Conditional request cache limits must be non-negative entries and positive body bytes.');
    }
    const entries = new Map();

    function save(key, entry) {
        if (!maxEntries) return;
        entries.delete(key);
        entries.set(key, entry);
        while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    }

    return async function conditionalRequest(url, init = {}, performRequest = fetch) {
        const headers = new Headers(init.headers);
        const key = requestKey(url, init, headers);
        if (!key) return performRequest(url, init);

        const cached = entries.get(key);
        if (cached) {
            save(key, cached);
            headers.set('if-none-match', cached.etag);
            headers.delete('if-modified-since');
        }
        let response = await performRequest(url, { ...init, headers });

        if (response.status === 304) {
            if (cached) {
                const mergedHeaders = representationHeaders(cached.headers, response.headers);
                save(key, { ...cached, etag: mergedHeaders.get('etag'), headers: mergedHeaders });
                return new Response(cached.body, { status: 200, headers: mergedHeaders });
            }

            // An external validator or an evicted entry cannot supply a body.
            // Retry once without conditions; never return an empty successful read.
            headers.delete('if-none-match');
            headers.delete('if-modified-since');
            response = await performRequest(url, { ...init, headers });
            if (response.status === 304) {
                throw new Error('GitHub returned 304 without a cached representation.');
            }
        }

        const body = await readCacheableBody(response, maxBodyBytes);
        if (body !== null) {
            save(key, {
                body,
                etag: response.headers.get('etag'),
                headers: representationHeaders(response.headers, []),
            });
        } else if (response.status === 200 && !response.headers.get('etag')) {
            entries.delete(key);
        }
        return response;
    };
}

export const conditionalGitHubRequest = createConditionalGitHubRequest();
