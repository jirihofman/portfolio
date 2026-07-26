import Link from "next/link";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { GoMail, GoPerson } from "react-icons/go";
import data from "../../../data.json";
import { Card } from "../../components/card";
import { Navigation } from "../../components/nav";
import { getSocialAccounts, getUser } from "../../data";

export async function ContactPage({
	username,
	isCustomUser = false,
	user: providedUser,
}) {
	const [user, githubSocials] = await Promise.all([
		providedUser || getUser(username),
		getSocialAccounts(username),
	]);
	const email = user.email || (!isCustomUser ? data.email : null);
	const contacts = [];

	if (email) {
		contacts.push({
			icon: <GoMail size={20} />,
			href: `mailto:${email}`,
			label: "Email",
			handle: email,
		});
	}

	contacts.push({
		icon: <FaGithub size={20} />,
		href: `https://github.com/${encodeURIComponent(username)}`,
		label: "Github",
		handle: username,
	});

	githubSocials.forEach((social) => {
		switch (social.provider) {
			case "linkedin":
				contacts.push({
					icon: <FaLinkedin size={20} />,
					href: social.url,
					label: social.provider,
					handle: social.url.split("/").filter(Boolean).pop(),
				});
				break;
			case "twitter":
				contacts.push({
					icon: <FaXTwitter size={20} />,
					href: social.url,
					label: social.provider,
					handle: social.url.split("/").filter(Boolean).pop(),
				});
				break;
			default:
				contacts.push({
					icon: <GoPerson size={20} />,
					href: social.url,
					label: social.url.split("/")[2] || social.provider,
				});
		}
	});

	return (
		<div className="bg-linear-to-tl from-zinc-900/0 via-zinc-900 to-zinc-900/0">
			<Navigation username={isCustomUser ? username : undefined} />
			<div className="container flex items-center justify-center min-h-screen px-4 mx-auto">
				<div className="grid w-full grid-cols-1 gap-8 mx-auto mt-32 sm:mt-0 sm:grid-cols-3 lg:gap-16">
					{contacts.map((contact) => {
						const emailTransform =
							contact.label === "Email"
								? "sm:rotate-45 md:rotate-0 lg:rotate-45 xl:rotate-0"
								: "";

						return (
							<Card key={`${contact.label}-${contact.href}`}>
								<Link
									href={contact.href}
									target="_blank"
									rel="noreferrer"
									className="p-4 relative flex flex-col items-center gap-4 duration-700 group md:gap-8 md:py-24 lg:pb-48 md:p-16 sm:p-8"
								>
									<span
										className="absolute w-px h-2/3 bg-linear-to-b from-zinc-500 via-zinc-500/50 to-transparent"
										aria-hidden="true"
									/>
									<span className="relative z-10 flex items-center justify-center w-12 h-12 text-sm duration-1000 border rounded-full text-zinc-200 group-hover:text-white group-hover:bg-zinc-900 border-zinc-500 bg-zinc-900 group-hover:border-zinc-200 drop-shadow-orange">
										{contact.icon}
									</span>
									<div className="z-10 flex flex-col items-center">
										<span
											className={`whitespace-nowrap text-xl font-medium duration-150 lg:text-3xl text-zinc-200 group-hover:text-white font-display ${emailTransform}`}
										>
											{contact.handle}
										</span>
										<span className="mt-4 text-sm text-center duration-1000 text-zinc-400 group-hover:text-zinc-200">
											{contact.label}
										</span>
									</div>
								</Link>
							</Card>
						);
					})}
				</div>
			</div>
		</div>
	);
}
