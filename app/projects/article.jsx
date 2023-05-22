import Link from "next/link";
import { Github, Star } from "lucide-react";
import { VercelInfo } from "../components/vercel-info";

export const Article = ({ project }) => {

    const appLink = project.homepage ? project.homepage : project.html_url;

    return (
        <article className="p-4 md:p-8">
            <div className="flex justify-between gap-2 items-center">
                <span className="text-xs duration-1000 text-zinc-200 group-hover:text-white group-hover:border-zinc-200 drop-shadow-orange">
                    {/* <Image src={`https://raw.githubusercontent.com/jirihofman/${project.name}/${project.default_branch}/public/favicon.ico`} alt={project.name} width={24} height={24} placeholder="blur" /> */}
                    <time dateTime={new Date(project.created_at).toISOString()}>
                        {new Date(project.created_at).toISOString().substring(0, 10)}
                    </time>
                </span>
                <span className="text-zinc-500 text-xs flex items-center gap-1 ">
                    {/* <Eye className="w-4 h-4" />{" "}
                    {Intl.NumberFormat("en-US", { notation: "compact" }).format(project.watchers_count)} */}
                    {project.vercel && <VercelInfo info={{ ...project.vercel, owner: project.owner }} />}
                    <Star className="w-4 h-4" />{" "}
                    {Intl.NumberFormat("en-US", { notation: "compact" }).format(project.stargazers_count)}
                </span>
            </div>
            <Link href={appLink} legacyBehavior>
                <h2 className="z-20 text-xl font-medium duration-1000 lg:text-3xl text-zinc-200 group-hover:text-white font-display cursor-pointer" title={`Click to view the ${project.homepage ? 'app' : 'repo'}.`}>
                    <span className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-transparent bg-clip-text">
                        {project.name}
                    </span>
                </h2>
            </Link>
            <p className="z-20 mt-4 text-sm duration-1000 text-zinc-400 group-hover:text-zinc-200">
                {project.description}
            </p>
            <div className="flex justify-between gap-2 items-center float-right mt-2 border-t-2 border-gray-700">
                <span className="text-zinc-500 text-xs flex items-center gap-1" title="GitHub repository link.">
                    <Github className="w-4 h-4" /><Link href={project.html_url} className="hover:text-blue-800">{project.name}</Link>
                </span>
            </div>
        </article>
    );
};
