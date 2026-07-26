"use client";

import Link from "next/link";
import { GoDependabot, GoEye, GoEyeClosed } from "react-icons/go";
import { SiClaude, SiGithubcopilot } from "react-icons/si";
import { CodexIcon } from "../components/codex-icon";
import { VercelInfo } from "../components/vercel-info";
import { useProjectSecondaryData } from "./secondary-data-provider";

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact" });

function TechnologySkeleton() {
	return (
		<span
			aria-hidden="true"
			className="flex items-center justify-end gap-1"
		>
			{[0, 1, 2, 3].map((item) => (
				<span
					key={item}
					className="size-6 rounded-md bg-zinc-700/70 motion-safe:animate-pulse"
				/>
			))}
		</span>
	);
}

function MetricsSkeleton() {
	return (
		<span
			aria-hidden="true"
			className="grid w-full grid-cols-5 items-center gap-2"
		>
			{[0, 1, 2, 3, 4].map((item) => (
				<span
					key={item}
					className="h-4 rounded-sm bg-zinc-700/70 motion-safe:animate-pulse"
				/>
			))}
		</span>
	);
}

export function ProjectTechnology({ repositoryKey }) {
	const {
		status,
		repository,
		showLoader,
	} = useProjectSecondaryData(repositoryKey);
	const isLoading = status === "loading";

	return (
		<span
			aria-busy={isLoading}
			className="flex h-7 w-40 max-w-[52vw] shrink-0 items-center justify-end"
		>
			{isLoading && showLoader ? <TechnologySkeleton /> : null}
			{status === "ready" && repository?.vercel ? (
				<VercelInfo info={repository.vercel} />
			) : null}
			{isLoading ? (
				<span className="sr-only">
					Loading repository technology details
				</span>
			) : status === "error" ? (
				<span className="sr-only">
					Repository technology details unavailable
				</span>
			) : null}
		</span>
	);
}

function getAlertPresentation(alerts) {
	if (!alerts) {
		return {
			color: undefined,
			count: null,
			title: "Dependabot alert data unavailable.",
		};
	}

	const count =
		(alerts.critical || 0) +
		(alerts.high || 0) +
		(alerts.medium || 0) +
		(alerts.low || 0);
	const color =
		alerts.critical > 0
			? "red"
			: alerts.high > 0
				? "orange"
				: alerts.medium > 0
					? "yellow"
					: alerts.low > 0
						? "blue"
						: "gray";

	return {
		color,
		count,
		title:
			count > 0
				? `Open Dependabot alerts: ${JSON.stringify(alerts)}`
				: "No open Dependabot alerts.",
	};
}

export function ProjectMetrics({ repositoryKey }) {
	const {
		status,
		repository,
		showLoader,
	} = useProjectSecondaryData(repositoryKey);
	const isLoading = status === "loading";
	const isPending = isLoading || status === "restoring";
	const metrics = repository?.ownerMetrics || {};
	const views = metrics.views;
	const alerts = getAlertPresentation(metrics.openAlertsBySeverity);

	return (
		<span
			aria-busy={isLoading}
			className="inline-flex h-7 w-48 max-w-[58vw] shrink-0 items-center gap-2 text-xs text-zinc-500"
		>
			{isPending ? (
				isLoading && showLoader ? <MetricsSkeleton /> : null
			) : (
				<>
					<span
						title={
							views
								? "Unique repository visitors: Last 14 days / Yesterday (GitHub API has a 24-hour delay)."
								: "Repository traffic data unavailable."
						}
						className="flex min-w-6 items-center gap-1"
					>
						{views ? (
							<>
								<GoEye className="size-4 shrink-0" />
								{compactNumber.format(views.sumUniques || 0)}/
								{compactNumber.format(views.todayUniques || 0)}
							</>
						) : (
							<GoEyeClosed className="size-4" />
						)}
					</span>
					<span
						title={alerts.title}
						className="flex min-w-4 items-center gap-1"
					>
						<GoDependabot
							className="size-4 shrink-0"
							fill={alerts.color}
						/>
						{alerts.count === null ? null : compactNumber.format(alerts.count)}
					</span>
					<AgentMetric
						count={metrics.copilotPRCount}
						href={`https://github.com/${repositoryKey}/pulls?q=is%3Amerged+author%3A%40Copilot+`}
						label="Copilot PRs merged"
						icon={
							<SiGithubcopilot className="size-3.5 text-[#8534F3]" />
						}
					/>
					<AgentMetric
						count={metrics.codexCount}
						href={`https://github.com/${repositoryKey}/pulls?q=is%3Apr+is%3Amerged+label%3Acodex`}
						label="Codex-labeled PRs merged"
						icon={<CodexIcon className="size-3.5 text-cyan-300" />}
					/>
					<AgentMetric
						count={metrics.claudeCount}
						href={`https://github.com/${repositoryKey}/pulls?q=is%3Apr+is%3Amerged+label%3Aclaude`}
						label="Claude-labeled PRs merged"
						icon={<SiClaude className="size-3.5 text-orange-300" />}
					/>
				</>
			)}
			{isLoading ? (
				<span className="sr-only">Loading repository metrics</span>
			) : status === "error" ? (
				<span className="sr-only">Repository metrics unavailable</span>
			) : null}
		</span>
	);
}

function AgentMetric({ count, href, icon, label }) {
	if (count === null || count === undefined) {
		return (
			<span title={`${label} data unavailable.`} className="inline-flex size-4">
				{icon}
			</span>
		);
	}

	return (
		<Link
			href={href}
			title={`${label}: ${count}`}
			aria-label={`${label}: ${count}`}
			className="flex min-w-4 items-center gap-1 hover:text-blue-500"
			target="_blank"
			rel="noopener noreferrer"
		>
			{icon}
			{compactNumber.format(count)}
		</Link>
	);
}
