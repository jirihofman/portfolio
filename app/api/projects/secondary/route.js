import {
	getOwnerProjectSecondaryData,
} from "../../../data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL =
	"public, max-age=300, s-maxage=21600, stale-while-revalidate=86400";

export async function GET(request) {
	if (new URL(request.url).search) {
		return Response.json(
			{ error: "Query parameters are not supported." },
			{
				status: 400,
				headers: { "Cache-Control": "no-store" },
			},
		);
	}

	try {
		const repositories = await getOwnerProjectSecondaryData();

		return Response.json(
			{
				schemaVersion: 1,
				generatedAt: new Date().toISOString(),
				repositories,
			},
			{
				headers: { "Cache-Control": CACHE_CONTROL },
			},
		);
	} catch (error) {
		console.error("Failed to build project secondary data:", error);
		return Response.json(
			{ error: "Project details are temporarily unavailable." },
			{
				status: 503,
				headers: { "Cache-Control": "no-store" },
			},
		);
	}
}
