// Request-based heuristics for the same 30 completed UTC days as AI usage.
export function getModelPreference(usage) {
  if (
    !usage ||
    !Number.isSafeInteger(usage.requests) ||
    usage.requests < 10 ||
    !Array.isArray(usage.models) ||
    !usage.models.length
  )
    return null;
  if (
    usage.models.some(
      (model) => !Number.isSafeInteger(model.requests) || model.requests < 0,
    )
  )
    return null;
  const models = [...usage.models].sort((a, b) => b.requests - a.requests);
  if (
    models.reduce((total, model) => total + model.requests, 0) !==
    usage.requests
  )
    return null;
  const [first, second] = models;
  if (
    first.requests / usage.requests < 0.6 ||
    (first.requests - (second?.requests ?? 0)) / usage.requests < 0.2
  )
    return null;
  const name = displayModelName(first.model);
  if (!name) return null;
  return first.requests >= 100
    ? `I use ${name} a lot on OpenRouter lately.`
    : `I dabble with ${name} on OpenRouter lately.`;
}

function displayModelName(model) {
  if (typeof model !== "string") return null;
  // Keep version and variant information; never guess a model from a partial ID.
  const match =
    /^(openai|anthropic)\/([a-z0-9]+(?:[.-][a-z0-9]+)*)(:free)?$/.exec(model);
  if (!match) return /^[a-z0-9.-]+\/[a-z0-9:._-]+$/i.test(model) ? model : null;
  const name = match[2]
    .split("-")
    .map((part) => {
      if (part === "gpt") return "GPT";
      if (/^o\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
  return `${match[1] === "openai" ? "OpenAI " : ""}${name}${match[3] ? " (free)" : ""}`;
}
