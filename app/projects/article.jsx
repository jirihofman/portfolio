import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { GoDependabot, GoEye, GoEyeClosed, GoStar } from 'react-icons/go';
import { SiGithubcopilot } from 'react-icons/si';
import { VercelInfo } from "../components/vercel-info";
import { getTrafficPageViews, getDependabotAlerts, getCopilotPRs } from "../data";
import Popover from "../components/popover";

export const Article = async ({ project }) => {

    const appLink = project.homepage ? project.homepage : project.html_url;

    /** Repository visitors info. */
    let views = <Popover 
        button={<span className="flex items-center gap-1"><GoEyeClosed className="w-4 h-4" /></span>}
        content="Can't get traffic data for someone else's repo."
    />;
    let alerts = <Popover 
        button={<span><GoDependabot className="w-4 h-4" /></span>}
        content="Can't get alerts data for someone else's repo."
    />;
    let copilotPRs = <Popover 
        button={<span><SiGithubcopilot className="w-4 h-4" /></span>}
        content="Can't get Copilot data for someone else's repo."
    />;
    const isGitHubUser = process.env.GITHUB_USERNAME === project.owner.login;
    if (isGitHubUser) {
        try {
            const [{ todayUniques, sumUniques } = {}, openAlertsBySeverity, copilotPRCount] = await Promise.all([
                getTrafficPageViews(project.owner.login, project.name), 
                getDependabotAlerts(project.owner.login, project.name),
                getCopilotPRs(project.owner.login, project.name)
            ]);
            
            views = <Popover
                button={<span className="flex items-center gap-1">
                    <GoEye className="w-4 h-4" />{" "}
                    {Intl.NumberFormat("en-US", { notation: "compact" }).format(sumUniques || 0)}/{Intl.NumberFormat("en-US", { notation: "compact" }).format(todayUniques || 0)}
                </span>}
                content={
                    <div>
                        <div className="font-semibold text-gray-800">Repository Visitors</div>
                        <div className="mt-1">
                            <div>Last 14 days: <span className="font-medium">{Intl.NumberFormat("en-US").format(sumUniques || 0)}</span></div>
                            <div>Today: <span className="font-medium">{Intl.NumberFormat("en-US").format(todayUniques || 0)}</span></div>
                        </div>
                        <div className="text-xs mt-2 text-gray-600">Unique visitors only</div>
                    </div>
                }
            />;

            const alertColor = (openAlertsBySeverity?.critical || 0) > 0 ? "red" : (openAlertsBySeverity?.high || 0) > 0 ? "orange" : (openAlertsBySeverity?.medium || 0) > 0 ? "yellow" : (openAlertsBySeverity?.low || 0) > 0 ? "blue" : "gray";
            const alertCountTotal = (openAlertsBySeverity?.critical || 0) + (openAlertsBySeverity?.high || 0) + (openAlertsBySeverity?.medium || 0) + (openAlertsBySeverity?.low || 0);

            alerts = <Popover
                button={<span className="flex items-center gap-1">
                    <GoDependabot className="w-4 h-4 danger" fill={alertColor} />{" "}            
                    {Intl.NumberFormat("en-US", { notation: "compact" }).format(alertCountTotal)}
                </span>}
                content={
                    <div>
                        <div className="font-semibold text-gray-800">Dependabot Alerts</div>
                        {alertCountTotal > 0 ? (
                            <div className="mt-1">
                                {(openAlertsBySeverity?.critical || 0) > 0 && <div className="text-red-600">Critical: {openAlertsBySeverity.critical}</div>}
                                {(openAlertsBySeverity?.high || 0) > 0 && <div className="text-orange-600">High: {openAlertsBySeverity.high}</div>}
                                {(openAlertsBySeverity?.medium || 0) > 0 && <div className="text-yellow-600">Medium: {openAlertsBySeverity.medium}</div>}
                                {(openAlertsBySeverity?.low || 0) > 0 && <div className="text-blue-600">Low: {openAlertsBySeverity.low}</div>}
                            </div>
                        ) : (
                            <div className="mt-1 text-green-600">No open alerts</div>
                        )}
                        <div className="text-xs mt-2 text-gray-600">Security vulnerabilities</div>
                    </div>
                }
            />;

            copilotPRs = <Popover
                button={<span className="flex items-center gap-1">
                    <SiGithubcopilot className="w-4 h-4" />{" "}
                    {Intl.NumberFormat("en-US", { notation: "compact" }).format(copilotPRCount || 0)}
                </span>}
                content={
                    <div>
                        <div className="font-semibold text-gray-800">GitHub Copilot PRs</div>
                        <div className="mt-1">
                            <div>Merged PRs: <span className="font-medium">{Intl.NumberFormat("en-US").format(copilotPRCount || 0)}</span></div>
                        </div>
                        <div className="text-xs mt-2 text-gray-600">Last 2 weeks</div>
                    </div>
                }
            />;
        } catch (error) {
            console.error('Failed to fetch project stats:', error);
            // Keep the existing fallback popovers for non-GitHub users
        }
    }

    return (
        <article className="p-4 md:p-8">
            <div className="flex justify-between gap-2 items-center">
                <span className="text-xs duration-1000 text-zinc-200 group-hover:text-white group-hover:border-zinc-200 drop-shadow-orange">
                    {/* <Image src={`https://raw.githubusercontent.com/jirihofman/${project.name}/${project.default_branch}/public/favicon.ico`} alt={project.name} width={24} height={24} placeholder="blur-sm" /> */}
                    <time dateTime={new Date(project.created_at).toISOString()} title="Created">
                        {new Date(project.created_at).toISOString().substring(0, 10)}
                    </time>
                </span>
                <span className="text-zinc-500 text-xs flex items-center gap-1 ">
                    {/* <Eye className="w-4 h-4" />{" "}
                    {Intl.NumberFormat("en-US", { notation: "compact" }).format(project.watchers_count)} */}
                    {project.vercel && <VercelInfo info={{ ...project.vercel, owner: project.owner }} />}
                    <span title="Total stars." className="flex items-center gap-1">
                        {/* <StarIcon className="w-4 h-4" />{" "} */}
                        <GoStar className="w-4 h-4" />{" "}
                        {Intl.NumberFormat("en-US", { notation: "compact" }).format(project.stargazers_count)}
                    </span>
                </span>
            </div>
            
            <Link href={appLink}>
                <h2 className="z-20 text-xl font-medium duration-1000 lg:text-3xl text-zinc-200 group-hover:text-white font-display cursor-pointer" title={`Click to view the ${project.homepage ? 'app' : 'repo'}.`}>
                    <span className="bg-linear-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-transparent bg-clip-text">
                        {project.name}
                    </span>
                </h2>
            </Link>
            <div className="z-20 mt-4 text-sm duration-1000 text-zinc-400 group-hover:text-zinc-200">
                {project.description}
            </div>
            <div className="flex justify-between gap-2 items-center float-left mt-2 border-t-2 border-gray-700 border-opacity-50">
                <span className="text-zinc-500 text-xs flex items-center gap-1">
                    {views}
                    {" "}
                    {alerts}
                    {" "}
                    {copilotPRs}
                </span>
            </div>
            <div className="flex justify-between gap-2 items-center float-right mt-2 border-t-2 border-gray-700 border-opacity-50">
                <span className="text-zinc-500 text-xs align-middle flex items-center gap-1" title="GitHub repository link.">
                    <FaGithub className="w-4 h-4" /><Link href={project.html_url} className="hover:text-blue-800">{project.name}</Link>
                </span>
            </div>
        </article>
    );
};
