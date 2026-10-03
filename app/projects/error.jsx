"use client";

export default function ProjectsError() {
	return (
		<div className="mx-auto max-w-7xl px-6 py-24 lg:px-8" role="alert">
			<h2 className="text-2xl font-bold text-zinc-100">Projects are temporarily unavailable</h2>
			<p className="mt-4 text-zinc-400">
				We couldn’t load the projects. Please try again in a moment.
			</p>
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="mt-6 rounded border border-zinc-600 px-4 py-2 text-zinc-100 hover:bg-zinc-800"
			>
				Try again
			</button>
		</div>
	);
}
