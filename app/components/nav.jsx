import { GoArrowLeft } from "react-icons/go";
import Link from "next/link";
import LoadingIndicator from "./loading-indicator";
import { createUserPath } from "../user/_lib/username";

export const Navigation = ({ username }) => {
	const userPath = username ? createUserPath(username) : null;
	const homeHref = userPath || "/";
	const projectsHref = userPath ? `${userPath}/projects` : "/projects";
	const contactHref = userPath ? `${userPath}/contact` : "/contact";

	return (
		<header>
			<div className="fixed inset-x-0 top-0 z-50 backdrop-blur duration-200 border-b bg-zinc-900/80 border-zinc-800/60">
				<div className="container flex flex-row-reverse items-center justify-between p-6 mx-auto">
					<div className="flex justify-between gap-8 text-base">
						<Link
							href={projectsHref}
							prefetch={false}
							className="duration-200 text-zinc-400 hover:text-zinc-100 relative block"
						>
							<span className="inline-flex items-center">
								Projects <LoadingIndicator />
							</span>
						</Link>
						<Link
							href={contactHref}
							className="duration-200 text-zinc-400 hover:text-zinc-100 relative block"
						>
							<span className="inline-flex items-center">
								Contact <LoadingIndicator />
							</span>
						</Link>
					</div>

					<Link
						href={homeHref}
						className="duration-200 text-zinc-300 hover:text-zinc-100"
						aria-label={username ? `Back to ${username}'s profile` : "Back to home"}
					>
						<GoArrowLeft className="w-6 h-6" />
					</Link>
				</div>
			</div>
		</header>
	);
};
