import { PiOpenAiLogo } from "react-icons/pi";

const StatItem = ({ value, label }) => (
	<div className="flex flex-col items-center sm:items-start">
		<p className="text-sm font-bold mr-1">{value}</p>
		<p className="text-xs text-zinc-400">{label}</p>
	</div>
);

export async function OpenAIStatsWidget() {
	const apiKey = process.env.OPENAI_API_KEY;
	const date30DaysAgo = new Date().setDate(new Date().getDate() - 30);
	const date = new Date(date30DaysAgo).toISOString().split("T")[0];

	const response = await fetch(`https://api.openai.com/v1/usage?date=${date}`, {
		headers: {
			"Authorization": `Bearer ${apiKey}`
		},
		next: {
			revalidate: 86400
		}
	});

	const allData = await response.json();

	if (!allData || !allData.data) {
		return <div className="text-red-500">No data available.</div>;
	}

	const completionData = allData.data;

	const stats = completionData.reduce((acc, item) => {
		acc.total_requests += item.n_requests || 0;
		acc.total_context_tokens += item.n_context_tokens_total || 0;
		acc.total_generated_tokens += item.n_generated_tokens_total || 0;
		return acc;
	}, {
		total_requests: 0,
		total_context_tokens: 0,
		total_generated_tokens: 0,
	});

	return (<div className="bg-zinc-900 text-zinc-100 shadow rounded-lg p-4 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
		<div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
			<div className="flex items-center justify-center sm:justify-start w-full sm:w-auto">
				<PiOpenAiLogo className="h-5 w-5 mr-2" />
				<span className="text-sm font-medium">OpenAI Usage</span>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
				<StatItem value={stats.total_requests} label="Requests" />
				<StatItem value={stats.total_context_tokens} label="Context Tokens" />
				<StatItem value={stats.total_generated_tokens} label="Generated Tokens" />
			</div>
		</div>
	</div>);
}
