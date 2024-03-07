import { getRecentUserActivity } from "../data";

export const RecentActivity = async ({ username }) => {

    const recentUserActivity = await getRecentUserActivity(username);
    const activitySummary = recentUserActivity.reduce((acc, activity) => {

        if (activity.type === 'PushEvent') {
            acc.commits = acc.commits || 0;
            acc.commits += activity.payload.size;
        } else if (activity.type === 'PullRequestReviewEvent') {
            acc.reviews = acc.reviews || 0;
            acc.reviews++;
        } else if (activity.type === 'IssueCommentEvent') {
            acc.commentsCreated = acc.commentsCreated || 0;
            acc.commentsCreated += activity.payload.action === 'created' ? 1 : 0;
            acc.commentsEdited = acc.commentsEdited || 0;
            acc.commentsEdited += activity.payload.action === 'edited' ? 1 : 0;
        } else if (activity.type === 'PullRequestEvent') {
            acc.prsOpened = acc.prsOpened || 0;
            acc.prsOpened += activity.payload.action === 'opened' ? 1 : 0;
            acc.prsMerged = acc.prsMerged || 0;
            acc.prsMerged += activity.payload.action === 'closed' && activity.payload.pull_request.merged ? 1 : 0;
        } else if (activity.type === 'CreateEvent') {
            if (activity.payload.ref_type === 'tag') {
                acc.tags = acc.tags || 0;
                acc.tags++;
            } else {
                acc.branches = acc.branches || 0;
                acc.branches++;
            }
        }

        acc[activity.type] = acc[activity.type] || 0;
        acc[activity.type]++;

        return acc;
    }, {});

    // End result: I pushed 2 commits and reviewed 1 PR.
    const activitySummaryString = Object.keys(activitySummary).map((key) => {
        const value = activitySummary[key];
        if (key === 'commits' && value) {
            return `pushed ${value} commit${value === 1 ? '' : 's'}`;
        } else if (key === 'reviews' && value) {
            return `reviewed ${value} PR${value === 1 ? '' : 's'}`;
        } else if (key === 'prsOpened' && value) {
            return `opened ${value} PR${value === 1 ? '' : 's'}`;
        } else if (key === 'prsMerged' && value) {
            return `merged ${value} PR${value === 1 ? '' : 's'}`;
        } else if (key === 'commentsCreated' && value) {
            return `made ${value} comment${value === 1 ? '' : 's'}`;
        // } else if (key === 'commentsEdited' && value) {
        // 	return `edited ${value} comment${value === 1 ? '' : 's'}`;
        } else if (key === 'branches' && value) {
            return `created ${value} branch${value === 1 ? '' : 'es'}`;
        } else if (key === 'tags' && value) {
            return `created ${value} tag${value === 1 ? '' : 's'}`;
        } else {
            return null;
        }
    }).filter(Boolean).join(', ');

    return (
        <div>
            <span className="text-sm">
                {activitySummaryString && 'In last 90 days on GitHub  I ' + activitySummaryString + ' in public repositories.'}
            </span>
            {/* {JSON.stringify(recentUserActivity.map(a => a.payload?.review && Object.keys(a.payload?.review).join()), null, 4)} */}
            {/* {JSON.stringify(Object.keys(recentUserActivity[4]).join(), null, 4)} */}
            {/* {JSON.stringify(recentUserActivity.filter(a => a.type === 'PullRequestEvent')[2], null, 4)} */}
            {/* {JSON.stringify(activitySummary, null, 4)} */}
        </div>
    );
};
