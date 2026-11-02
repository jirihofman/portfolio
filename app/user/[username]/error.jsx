"use client";

export default function UserError({ reset }) {
    return (
        <main className="mx-auto max-w-xl px-6 py-24 text-zinc-200">
            <p>This profile is temporarily unavailable.</p>
            <button className="mt-4 underline" onClick={() => reset()}>
                Try again
            </button>
        </main>
    );
}
