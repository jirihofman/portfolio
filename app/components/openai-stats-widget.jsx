import { FaRegQuestionCircle, FaAdjust, FaRegPaperPlane } from 'react-icons/fa';

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

	// Sleep 2 sec
	await new Promise(resolve => setTimeout(resolve, 2000));

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

	return (
		<div className="bg-gray-800 text-white shadow rounded-lg p-2 flex items-center justify-between">
			<div className="flex items-center">
				<p className="text-sm font-bold mr-1">{stats.total_requests}</p>
				<p className="text-xs text-gray-400">Requests</p>
			</div>
			<div className="flex items-center">
				<p className="text-sm font-bold mr-1">{stats.total_context_tokens.toLocaleString()}</p>
				<p className="text-xs text-gray-400">Context Tokens</p>
			</div>
			<div className="flex items-center">
				<p className="text-sm font-bold mr-1">{stats.total_generated_tokens.toLocaleString()}</p>
				<p className="text-xs text-gray-400">Generated Tokens</p>
			</div>
		</div>
	);
}
