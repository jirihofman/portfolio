// Share work only while it is in flight. Settled failures never become cache hits.
export function singleFlight(load, normalize = (args) => args) {
    const pending = new Map();
    return (...input) => {
        const args = normalize(input);
        const key = JSON.stringify(args);
        if (!pending.has(key)) {
            const promise = Promise.resolve().then(() => load(...args));
            pending.set(key, promise);
            const clear = () => {
                if (pending.get(key) === promise) pending.delete(key);
            };
            promise.then(clear, clear);
        }
        return pending.get(key);
    };
}

export const normalizeGitHubArguments = (args) => args.map((value) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value);
