// Partial refreshes must neither replace successful data nor renew its age.
export function selectSecondarySnapshot(previous, payload, now = Date.now()) {
    if (payload.complete !== true) return previous || payload;
    return {
        schemaVersion: payload.schemaVersion,
        generatedAt: payload.generatedAt,
        repositories: payload.repositories,
        cachedAt: now,
    };
}
