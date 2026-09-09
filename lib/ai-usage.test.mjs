import test from "node:test";
import assert from "node:assert/strict";
import { aggregateActivity, parseCachedTokens } from "./ai-usage.mjs";
const now = new Date("2026-09-09T12:00:00Z");
test("combines endpoints by model, fills days, and counts reasoning only once", () => {
  const rows = [
    {
      date: "2026-09-08",
      model: "a/model",
      requests: 2,
      prompt_tokens: 100,
      completion_tokens: 40,
      reasoning_tokens: 20,
      endpoint_id: "private",
      usage: 42,
      user_id: "private",
    },
    {
      date: "2026-09-08T00:00:00Z",
      model: "a/model",
      requests: 3,
      prompt_tokens: 50,
      completion_tokens: 10,
      reasoning_tokens: 5,
    },
    {
      date: "2026-08-10",
      model: "b/model",
      requests: 1,
      prompt_tokens: 10,
      completion_tokens: 5,
    },
    { date: "2026-09-09", model: "today", requests: 99 },
    { date: "2026-08-09", model: "expired", requests: 99 },
  ];
  const result = aggregateActivity(rows, now);
  assert.equal(result.requests, 6);
  assert.equal(result.tokens, 215);
  assert.equal(result.reasoningTokens, 25);
  assert.equal(result.activeDays, 2);
  assert.equal(result.days.length, 30);
  assert.deepEqual(result.models[0], {
    model: "a/model",
    requests: 5,
    tokens: 200,
  });
  assert.equal(result.days.at(-1).requests, 5);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(JSON.stringify(result).includes("usage"), false);
});
test("empty and malformed counts stay finite and nonnegative", () => {
  const empty = aggregateActivity([], now);
  assert.equal(empty.requests, 0);
  assert.deepEqual(empty.models, []);
  const result = aggregateActivity(
    [
      null,
      { date: "bad" },
      {
        date: "2026-09-08",
        requests: -1,
        prompt_tokens: Infinity,
        completion_tokens: 10,
        reasoning_tokens: 50,
      },
    ],
    now,
  );
  assert.equal(result.requests, 0);
  assert.equal(result.tokens, 10);
  assert.equal(result.reasoningTokens, 10);
});

test("cached tokens distinguish zero from missing, invalid, and partial analytics", () => {
  const payload = (value) => ({
    data: { data: [{ cached_tokens: value }], metadata: { truncated: false } },
  });
  assert.equal(parseCachedTokens(payload("23783")), 23783);
  assert.equal(parseCachedTokens(payload("0")), 0);
  for (const value of [null, undefined, "", -1, Infinity, "garbage", 1.5]) {
    assert.equal(parseCachedTokens(payload(value)), null);
  }
  assert.equal(
    parseCachedTokens({ data: { data: [], metadata: { truncated: false } } }),
    null,
  );
  const partial = payload("10");
  partial.data.metadata.truncated = true;
  assert.equal(parseCachedTokens(partial), null);
});
