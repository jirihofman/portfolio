import Link from "next/link";
import Image from "next/image";
import { getUserOrganizations } from "../data";

export const ProfileOrganizations = async ({ username }) => {

	const organizations = (await getUserOrganizations(username)).data.user?.organizations.nodes;

	return (
		<p>I'm building stuff{
			organizations?.length > 0 ? <>
				{" "}at{" "}
				<span className="mt-3 overflow-hidden">
					{organizations.map((org, i, a) =>
						<span key={org.name}>
							{i > 0 && i < a.length - 1 && ', '}
							{i > 0 && i === a.length - 1 && ' and '}
							<Link
								target="_blank"
								href={org.websiteUrl || org.url}
								className="underline duration-500 hover:text-zinc-300"
							>
								<span className="text">{org.name}</span>
								<Image className="ms-1 inline-block rounded-md" src={org.avatarUrl} alt={org.name} title={[org.name, org.description].filter(o => !!o).join(': ')} width={24} height={24} />
							</Link>
						</span>
					)}
				</span>
			</> : '.'
		}
		</p>
	);
};
