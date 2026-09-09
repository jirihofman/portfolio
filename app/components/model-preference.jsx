import Link from "next/link";
import { getAiUsage, isAiUsageEnabled } from "../ai-usage/data";
import { getModelPreference } from "../../lib/model-preference.mjs";

export async function ModelPreference() {
  if (!isAiUsageEnabled()) return null;
  const sentence = getModelPreference(await getAiUsage());
  if (!sentence) return null;
  return (
    <p className="text-sm max-w-3xl mx-auto px-4 leading-relaxed">
      <Link
        href="/ai-usage"
        prefetch={false}
        className="underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300"
        title="Based on requests in the last 30 completed UTC days"
      >
        {sentence}
      </Link>
    </p>
  );
}
