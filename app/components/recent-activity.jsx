import {
    getRecentUserActivity,
    getCopilotPRsAccountWide,
    getCodexCoauthoredCommitsAccountWide,
    getCodexLabeledPRsAccountWide,
    getClaudeCoauthoredCommitsAccountWide,
    getClaudeLabeledPRsAccountWide,
} from "../data";
import { SiGithubcopilot } from 'react-icons/si';
import { SiClaude } from 'react-icons/si';
import { FaRobot } from 'react-icons/fa';

function joinWithAnd(items) {
    return items.flatMap((item, index) => index === 0 ? [item] : [' and ', item]);
}


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
                {activitySummaryString && 'Recent public output: ' + activitySummaryString + '.'}
            </span>
            {/* {JSON.stringify(recentUserActivity.map(a => a.payload?.review && Object.keys(a.payload?.review).join()), null, 4)} */}
            {/* {JSON.stringify(Object.keys(recentUserActivity[4]).join(), null, 4)} */}
            {/* {JSON.stringify(recentUserActivity.filter(a => a.type === 'PullRequestEvent')[2], null, 4)} */}
            {/* {JSON.stringify(activitySummary, null, 4)} */}
        </div>
    );
};

export const CopilotActivity = async ({ username }) => {
    const [copilotPRCount, codexCoauthoredCommitCount, codexLabeledPRCount, claudeCoauthoredCommitCount, claudeLabeledPRCount] = await Promise.all([
        getCopilotPRsAccountWide(username),
        getCodexCoauthoredCommitsAccountWide(username),
        getCodexLabeledPRsAccountWide(username),
        getClaudeCoauthoredCommitsAccountWide(username),
        getClaudeLabeledPRsAccountWide(username),
    ]);

    const codexCount = codexCoauthoredCommitCount + codexLabeledPRCount;
    const claudeCount = claudeCoauthoredCommitCount + claudeLabeledPRCount;

    if (copilotPRCount === 0 && codexCount === 0 && claudeCount === 0) {
        return null;
    }

    const agentParts = [];

    if (copilotPRCount > 0) {
        agentParts.push(
            <span key="copilot" className="inline-flex items-center gap-1 mx-1">
                Copilot <SiGithubcopilot className="w-4 h-4 text-[#8534F3]" aria-label="GitHub Copilot icon" /> ({copilotPRCount} merged PR{copilotPRCount === 1 ? '' : 's'})
            </span>
        );
    }

    if (codexCount > 0) {
        agentParts.push(
            <span key="codex" className="inline-flex items-center gap-1 mx-1">
                Codex <FaRobot className="w-4 h-4 text-cyan-300" aria-label="Codex icon" /> ({codexCount} contribution{codexCount === 1 ? '' : 's'})
            </span>
        );
    }

    if (claudeCount > 0) {
        agentParts.push(
            <span key="claude" className="inline-flex items-center gap-1 mx-1">
                Claude <SiClaude className="w-4 h-4 text-orange-300" aria-label="Claude icon" /> ({claudeCount} contribution{claudeCount === 1 ? '' : 's'})
            </span>
        );
    }

    const agentSummary = joinWithAnd(agentParts);

    return (
        <div>
            <p className="text-sm max-w-3xl mx-auto leading-relaxed">
                AI-assisted delivery signals: {agentSummary}.
            </p>
        </div>
    );
};
