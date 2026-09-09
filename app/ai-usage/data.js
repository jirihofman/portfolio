import "server-only";
import { unstable_cache } from "next/cache";
import { aggregateActivity, parseCachedTokens } from "../../lib/ai-usage.mjs";

async function getCachedTokens(now) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/analytics/query",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_MANAGEMENT_KEY.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metrics: ["cached_tokens"],
          time_range: { start: start.toISOString(), end: end.toISOString() },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return null;
    return parseCachedTokens(await response.json());
  } catch {
    return null;
  }
}

export function isAiUsageEnabled() {
  return Boolean(process.env.OPENROUTER_MANAGEMENT_KEY?.trim());
}

// Cache only the public aggregates, never the key or raw upstream response.
const loadUsage = unstable_cache(
  async () => {
    const now = new Date();
    const response = await fetch("https://openrouter.ai/api/v1/activity", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_MANAGEMENT_KEY.trim()}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("AI usage unavailable");
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error("AI usage unavailable");
    return {
      ...aggregateActivity(payload.data, now),
      cachedTokens: await getCachedTokens(now),
      updatedAt: new Date().toISOString(),
    };
  },
  ["openrouter-public-usage-v2"],
  { revalidate: 6 * 60 * 60 },
);

export async function getAiUsage() {
  try {
    return await loadUsage();
  } catch {
    return null;
  }
}
