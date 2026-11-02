import { getUser } from "../../../app/data";
import { isValidGitHubUsername } from "../../../app/user/_lib/username";

export default async function users(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        return res.status(405).json({ error: "Method not allowed." });
    }
    const { username } = req.query;
    if (!isValidGitHubUsername(username)) {
        return res.status(400).json({ error: "A valid GitHub username is required." });
    }
    try {
        const user = await getUser(username);
        if (!user) {
            res.setHeader("Cache-Control", "public, s-maxage=60");
            return res.status(404).json({ error: "GitHub user not found." });
        }
        res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
        return res.status(200).json({ id: user.id });
    } catch (error) {
        const status = error?.status === 429 || error?.status === 503
            ? error.status : error?.name === "TimeoutError" ? 504 : 502;
        if (error?.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
        return res.status(status).json({ error: "GitHub profiles are temporarily unavailable." });
    }
}
