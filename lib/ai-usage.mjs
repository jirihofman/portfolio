// Missing or partial analytics must not be presented as zero cache usage.
export function parseCachedTokens(payload) {
  const result = payload?.data;
  if (
    result?.metadata?.truncated !== false ||
    result?.warnings?.length ||
    !Array.isArray(result?.data) ||
    result.data.length !== 1
  )
    return null;
  const raw = result.data[0]?.cached_tokens;
  if (
    typeof raw !== "number" &&
    !(typeof raw === "string" && /^\d+$/.test(raw))
  )
    return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// Only explicitly approved aggregate fields leave this function.
export function aggregateActivity(rows, now = new Date()) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - 30 + i);
    return { date: date.toISOString().slice(0, 10), requests: 0, tokens: 0 };
  });
  const byDay = new Map(days.map((day) => [day.date, day]));
  const byModel = new Map();
  let requests = 0,
    inputTokens = 0,
    outputTokens = 0,
    reasoningTokens = 0;
  const count = (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : 0;
  for (const row of rows) {
    if (!row || typeof row.date !== "string") continue;
    const day = byDay.get(row.date.slice(0, 10));
    if (!day) continue;
    const calls = count(row.requests);
    const input = count(row.prompt_tokens);
    const output = count(row.completion_tokens);
    const model =
      typeof row.model === "string" && row.model ? row.model : "Unknown model";
    const entry = byModel.get(model) || { model, requests: 0, tokens: 0 };
    entry.requests += calls;
    entry.tokens += input + output;
    byModel.set(model, entry);
    day.requests += calls;
    day.tokens += input + output;
    requests += calls;
    inputTokens += input;
    outputTokens += output;
    reasoningTokens += Math.min(count(row.reasoning_tokens), output);
  }
  return {
    requests,
    inputTokens,
    outputTokens,
    reasoningTokens,
    tokens: inputTokens + outputTokens,
    activeDays: days.filter((day) => day.requests > 0).length,
    days,
    models: [...byModel.values()].sort(
      (a, b) => b.requests - a.requests || a.model.localeCompare(b.model),
    ),
  };
}
