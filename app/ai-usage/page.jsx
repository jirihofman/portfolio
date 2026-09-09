import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Navigation } from "../components/nav";
import { getAiUsage, isAiUsageEnabled } from "./data";

export const metadata = {
  title: "AI usage",
  description:
    "Aggregate OpenRouter activity and model preferences. No prompts or personal information.",
};
export const dynamic = "force-dynamic";
const number = (value) => new Intl.NumberFormat("en-US").format(value);
const dateLabel = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
const panel = "rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6";

async function Usage() {
  const usage = await getAiUsage();
  if (!usage)
    return (
      <section className={panel} role="status">
        <h2 className="text-xl text-zinc-100">
          Usage is temporarily unavailable
        </h2>
        <p className="mt-3 text-zinc-400">
          OpenRouter statistics could not be loaded. Please try again shortly.
        </p>
        <a
          href="/ai-usage"
          className="mt-5 inline-block text-emerald-300 underline"
        >
          Try again
        </a>
      </section>
    );
  const maxRequests = Math.max(1, ...usage.days.map((day) => day.requests));
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <p>
          {dateLabel(usage.days[0].date)} – {dateLabel(usage.days.at(-1).date)}{" "}
          · Last 30 completed UTC days
        </p>
        <p>
          Updated{" "}
          {new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          }).format(new Date(usage.updatedAt))}{" "}
          UTC
        </p>
      </div>
      <section
        aria-label="Usage totals"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {[
          ["Requests", usage.requests, "Across all models"],
          ["Tokens", usage.tokens, "Input + output"],
          ["Models explored", usage.models.length, "Distinct models used"],
          ["Active days", usage.activeDays, "Out of 30 days"],
        ].map(([label, value, detail]) => (
          <div className={panel} key={label}>
            <p className="text-sm text-zinc-400">{label}</p>
            <p className="my-3 break-words text-3xl font-display text-zinc-100 sm:text-4xl">
              {number(value)}
            </p>
            <p className="text-xs text-zinc-500">{detail}</p>
          </div>
        ))}
      </section>
      {usage.requests === 0 && (
        <section className={panel}>
          <h2 className="text-xl text-zinc-100">No activity in this period</h2>
          <p className="mt-2 text-zinc-400">
            New OpenRouter usage will appear here after the UTC day is complete.
          </p>
        </section>
      )}
      <section className={panel} aria-labelledby="daily-heading">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 id="daily-heading" className="text-xl font-display">
            Daily activity
          </h2>
          <span className="text-sm text-zinc-400">
            Requests per day · Peak{" "}
            {number(maxRequests === 1 && !usage.requests ? 0 : maxRequests)}
          </span>
        </div>
        <div
          className="mt-8 flex h-40 items-end gap-1 sm:gap-2"
          role="img"
          aria-label={`Daily requests from ${usage.days[0].date} to ${usage.days.at(-1).date}. Exact counts are in the daily totals below.`}
        >
          {usage.days.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${number(day.requests)} requests`}
              className={`min-w-0 flex-1 rounded-t-sm ${day.requests ? "bg-emerald-400/80" : "bg-zinc-800"}`}
              style={{
                height: `${day.requests ? Math.max(3, (day.requests / maxRequests) * 100) : 2}%`,
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-between text-xs text-zinc-500">
          <span>{dateLabel(usage.days[0].date)}</span>
          <span>{dateLabel(usage.days[14].date)}</span>
          <span>{dateLabel(usage.days.at(-1).date)}</span>
        </div>
        <details className="mt-6 text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-100">
            View daily totals
          </summary>
          <div className="mt-4 max-h-64 overflow-auto">
            <table className="w-full text-left">
              <caption className="sr-only">
                Daily requests and tokens in UTC
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date (UTC)</th>
                  <th scope="col">Requests</th>
                  <th scope="col">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {usage.days.map((day) => (
                  <tr key={day.date} className="border-t border-zinc-800">
                    <th scope="row" className="py-2 font-normal">
                      {day.date}
                    </th>
                    <td>{number(day.requests)}</td>
                    <td>{number(day.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className={panel}>
          <h2 className="text-xl font-display">Model preferences</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Ranked by requests, with share of total activity.
          </p>
          <div className="mt-6 space-y-6">
            {usage.models.length ? (
              usage.models.map((model) => (
                <div key={model.model}>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="break-all text-zinc-200">
                      {model.model}
                    </span>
                    <span className="text-zinc-400">
                      {number(model.requests)}{" "}
                      {model.requests === 1 ? "request" : "requests"} ·{" "}
                      {usage.requests
                        ? ((model.requests / usage.requests) * 100).toFixed(1)
                        : "0.0"}
                      %
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-400/80"
                      style={{
                        width: `${usage.requests ? (model.requests / usage.requests) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {number(model.tokens)} tokens
                  </p>
                </div>
              ))
            ) : (
              <p className="text-zinc-500">No models used yet.</p>
            )}
          </div>
        </section>
        <section className={panel}>
          <h2 className="text-xl font-display">Token breakdown</h2>
          <dl className="mt-6 space-y-5">
            {[
              ["Input", usage.inputTokens],
              ...(usage.cachedTokens != null
                ? [["Of which cached", usage.cachedTokens]]
                : []),
              ["Output", usage.outputTokens],
              ["Of which reasoning", usage.reasoningTokens],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-zinc-400">{label}</dt>
                <dd className="mt-1 text-2xl text-zinc-200">{number(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs leading-5 text-zinc-500">
            {usage.cachedTokens != null &&
              "Cached tokens are included in input tokens. "}
            Reasoning is included in output tokens and is not counted twice in
            the total.
          </p>
        </section>
      </div>
    </>
  );
}

export default function AiUsagePage() {
  if (!isAiUsageEnabled()) notFound();
  return (
    <div className="min-h-screen bg-linear-to-tl from-black via-zinc-900/60 to-black text-zinc-100">
      <Navigation />
      <main className="mx-auto max-w-6xl space-y-6 px-5 pb-20 pt-32">
        <header className="pb-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-emerald-400">
            OpenRouter / Activity
          </p>
          <h1 className="text-4xl font-display sm:text-5xl">AI usage</h1>
          <p className="mt-5 max-w-2xl leading-7 text-zinc-400">
            A look at the models I use and how I use them. Aggregate activity
            only — no prompts, conversations, or personal details.
          </p>
        </header>
        <Suspense
          fallback={
            <p role="status" className={panel}>
              Loading OpenRouter activity…
            </p>
          }
        >
          <Usage />
        </Suspense>
        <footer className="border-t border-zinc-800 pt-6 text-xs leading-6 text-zinc-500">
          Source: OpenRouter. Today’s activity is excluded. Only model names and
          aggregate request and token counts are published; account information,
          API key details, and spending stay private.
        </footer>
      </main>
    </div>
  );
}
