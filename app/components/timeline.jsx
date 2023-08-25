"use client";

import { Timeline, Octicon, RelativeTime, ThemeProvider } from "@primer/react";
import { GitBranchIcon, GitCommitIcon, GitPullRequestIcon, TagIcon } from '@primer/octicons-react';
import Link from "next/link";

export const UserTimeline = ({ recentUserActivity }) => {
	
	const distinctTypes = [...new Set(recentUserActivity.map((activity) => activity.type))];
	return (
		<div>
			<ThemeProvider colorMode="dark">
			<Timeline clipSidebar>
				<div className="text-zinc-500 text-xs flex items-center gap-1 ">
					{JSON.stringify(distinctTypes, null, 4)}
				</div>
				{recentUserActivity
				// No delete events
				.filter((activity) => activity.type !== 'DeleteEvent')
				// .slice(0, 100)
				.map((activity) => {
					let repo = activity.repo.name;
					let baseUrl = 'https://github.com/' + repo;
					let url;
					let message = activity.payload.commits?.[0]?.message;
					let icon;
					switch (activity.type) {
						case 'PushEvent':
							icon = GitCommitIcon;
							message = 'Pushed ' + activity.payload.size + ' commit' + (activity.payload.size === 1 ? '' : 's') + ' to ' + activity.payload.ref;
							break;
							case 'PullRequestEvent':
								// TODO: avatairpair with dependabot
								icon = GitPullRequestIcon;
							const merged = activity.payload.pull_request.merged;
							const prNumber = activity.payload.pull_request.number;
							if (merged) {
								// message: "#PR was merged by {actor.login}"
								message =  ' was merged by ' + activity.actor.login;
							} else {
								message = activity.payload.action + ' a pull request.'
							}
							break;
						case 'CreateEvent':
							const isTag = activity.payload.ref_type === 'tag';
							icon = isTag ? TagIcon : GitBranchIcon;
							const href = <Link href={baseUrl + '/tree/' + activity.payload.ref} target="_blank">{activity.payload.ref}</Link>;
							message = <span>
								Created {activity.payload.ref_type} {href}
							</span>
							
							break;
						default:
							icon = GitCommitIcon;
							message = activity.type;
							break;
					}

					return <Timeline.Item key={activity.id}>
						<Timeline.Badge>
							<Octicon icon={icon} />
						</Timeline.Badge>
						<Timeline.Body>
							<span className="text-zinc-500 text-xs flex items-center gap-1 ">
								{repo}: {message}<br />
								<RelativeTime date={new Date(activity.created_at)} />
								{/* Repo: {activity.repo.name}<br /> */}
								{/* {JSON.stringify(activtipec22
									vity?.payload, null, 4)} */}
							</span>
						</Timeline.Body>
						
					</Timeline.Item>
				}
				)}
			</Timeline>
			</ThemeProvider>
		</div>
	);
};
