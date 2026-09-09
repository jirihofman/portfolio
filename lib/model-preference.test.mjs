import test from "node:test";
import assert from "node:assert/strict";
import { getModelPreference } from "./model-preference.mjs";
const usage = (first, second = 0, model = "openai/gpt-5.6-luna") => ({
  requests: first + second,
  models: [
    { model, requests: first },
    { model: "anthropic/claude-opus-4.8", requests: second },
  ],
});
test("requires enough requests and an unambiguous leader", () => {
  for (const value of [
    null,
    usage(9),
    usage(5, 5),
    usage(59, 41),
    { ...usage(10), requests: 11 },
  ])
    assert.equal(getModelPreference(value), null);
  assert.match(
    getModelPreference(usage(6, 4)),
    /^I dabble with OpenAI GPT 5.6 Luna/,
  );
  assert.match(getModelPreference(usage(60, 40)), /^I dabble/);
});
test("high usage requires 100 requests to the winning model, not overall", () => {
  assert.match(getModelPreference(usage(99, 50)), /^I dabble/);
  assert.match(getModelPreference(usage(100, 50)), /^I use .* a lot/);
});
test("preserves names, handles unsorted models, and suppresses unknown labels", () => {
  assert.match(
    getModelPreference(usage(20, 0, "anthropic/claude-opus-4.8")),
    /Claude Opus 4.8/,
  );
  assert.match(
    getModelPreference(usage(20, 0, "z-ai/glm-5.3")),
    /z-ai\/glm-5.3/,
  );
  assert.equal(getModelPreference(usage(20, 0, "Unknown model")), null);
  const value = usage(33, 14);
  value.models.reverse();
  assert.match(getModelPreference(value), /Luna/);
  assert.equal(value.models[0].requests, 14);
});
