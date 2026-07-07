export function CodexIcon({ className = "w-4 h-4", label = "OpenAI Codex icon" }) {
    return (
        <span
            role="img"
            aria-label={label}
            className={`inline-block shrink-0 bg-current align-[-0.125em] ${className}`}
            style={{
                WebkitMask: 'url(/codex-icon.svg) center / contain no-repeat',
                mask: 'url(/codex-icon.svg) center / contain no-repeat',
            }}
        />
    );
}
