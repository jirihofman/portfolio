import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { GoDependabot, GoEye, GoEyeClosed, GoStar } from 'react-icons/go';
import { VercelInfo } from "../components/vercel-info";
import { getTrafficPageViews, getDependabotAlerts } from "../data";

export const Article = async ({ project }) => {

    const appLink = project.homepage ? project.homepage : project.html_url;

    /** Repository visitors info. */
    let views = <span title="Can't get traffic data for someone else's repo." className="flex items-center gap-1"><GoEyeClosed className="w-4 h-4" /></span>;
    let alerts = <span title="Can't get alerts data for someone else's repo."><GoDependabot className="w-4 h-4" /></span>;
    const isGitHubUser = process.env.GITHUB_USERNAME === project.owner.login;
    if (isGitHubUser) {
        const [{ todayUniques, sumUniques } = {}, openAlertsBySeverity] = await Promise.all([getTrafficPageViews(project.owner.login, project.name), getDependabotAlerts(project.owner.login, project.name)]);
        views = <span title="Unique repository visitors: Last 14 days / Today." className="flex items-center gap-1">
            <GoEye className="w-4 h-4" />{" "}
            {Intl.NumberFormat("en-US", { notation: "compact" }).format(sumUniques)}/{Intl.NumberFormat("en-US", { notation: "compact" }).format(todayUniques)}
        </span>;

        const alertColor = openAlertsBySeverity.critical > 0 ? "red" : openAlertsBySeverity.high > 0 ? "orange" : openAlertsBySeverity.medium > 0 ? "yellow" : openAlertsBySeverity.low > 0 ? "blue" : "gray";
        const alertCountTotal = (openAlertsBySeverity.critical || 0) + (openAlertsBySeverity.high || 0) + (openAlertsBySeverity.medium || 0) + (openAlertsBySeverity.low || 0);
        const alertTitle = alertCountTotal > 0 ? `Open Dependabot alerts: ` + (JSON.stringify(openAlertsBySeverity)) : "No open Dependabot alerts.";

        alerts = <span title={alertTitle} className="flex items-center gap-1">
            <GoDependabot className="w-4 h-4 danger" fill={alertColor} />{" "}            
            {Intl.NumberFormat("en-US", { notation: "compact" }).format(alertCountTotal)}
        </span>;
    }

    return (
        <article className="p-4 md:p-8">
            <div className="flex justify-between gap-2 items-center">
                <span className="text-xs duration-1000 text-zinc-200 group-hover:text-white group-hover:border-zinc-200 drop-shadow-orange">
                    {/* <Image src={`https://raw.githubusercontent.com/jirihofman/${project.name}/${project.default_branch}/public/favicon.ico`} alt={project.name} width={24} height={24} placeholder="blur" /> */}
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
                    <span className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-transparent bg-clip-text">
                        {project.name}
                    </span>
                </h2>
            </Link>
            <p className="z-20 mt-4 text-sm duration-1000 text-zinc-400 group-hover:text-zinc-200">
                {project.description}
            </p>
            <div className="flex justify-between gap-2 items-center float-left mt-2 border-t-2 border-gray-700 border-opacity-50">
                <span className="text-zinc-500 text-xs flex items-center gap-1">
                    {views}
                    {" "}
                    {alerts}
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
