"use client";

import Image from "next/image";
import { MdUpgrade } from "react-icons/md";
import { RiTailwindCssFill } from "react-icons/ri";
import { SiReactbootstrap } from "react-icons/si";
import Popover from "./popover";

function compareVersions(version1, version2) {
	const parseVersion = (version) => {
		if (typeof version !== "string") {
			return [0];
		}

		return version
			.replace(/^v/, "")
			.split(".")
			.map((part) => Number.parseInt(part, 10) || 0);
	};
	const first = parseVersion(version1);
	const second = parseVersion(version2);
	const maxLength = Math.max(first.length, second.length);

	for (let index = 0; index < maxLength; index++) {
		const firstPart = first[index] || 0;
		const secondPart = second[index] || 0;

		if (firstPart < secondPart) return -1;
		if (firstPart > secondPart) return 1;
	}

	return 0;
}

const routerDescriptions = {
	app: " using App Router",
	pages: " using Pages Router",
	hybrid: " using both Pages and App Router",
	none: " using neither Pages nor App Router",
};

export function VercelInfo({ info }) {
	const details = info.details || {};
	const repositoryFrameworks = details.repositoryFrameworks || [];
	const nextjsVersion = details.nextjsVersion || "";
	const astroVersion = details.astroVersion || "";
	const nextjsLatestVersion = details.nextjsLatestVersion || "";
	const routerDescription =
		routerDescriptions[details.routerMode] || routerDescriptions.none;
	const upgradeIcons = repositoryFrameworks
		.filter(
			(framework) =>
				framework.hasUpgrade &&
				!(framework.type === "nextjs" && info.framework === "nextjs"),
		)
		.map((framework, index) => (
			<Popover
				key={`upgrade-${framework.type}-${index}`}
				button={<MdUpgrade aria-hidden="true" className="size-5" />}
				label={`Upgrade available for ${framework.name}: ${framework.version} to ${framework.latestVersion}`}
				content={
					<>
						<strong className="block">Upgrade available</strong>
						<span>
							{framework.name}: {framework.version} →{" "}
							{framework.latestVersion}
						</span>
					</>
				}
			/>
		));
	const nextUpgrade =
		info.framework === "nextjs" &&
		nextjsVersion &&
		nextjsLatestVersion &&
		compareVersions(nextjsVersion, nextjsLatestVersion) < 0 ? (
			<Popover
				button={<MdUpgrade aria-hidden="true" className="size-5" />}
				label={`Upgrade available for Next.js: ${nextjsVersion} to ${nextjsLatestVersion}`}
				content={
					<>
						<strong className="block">Upgrade available</strong>
						<span>
							Next.js: {nextjsVersion} → {nextjsLatestVersion}
						</span>
					</>
				}
			/>
		) : null;
	const frameworkIcon =
		info.framework === "nextjs" ? (
			<Popover
				button={
					<FrameworkImage
						src="/nextjs-icon-dark.svg"
						alt="Next.js icon"
					/>
				}
				content={`Next.js project${routerDescription}${
					nextjsVersion ? ` (v${nextjsVersion})` : ""
				}`}
			/>
		) : info.framework === "astro" ? (
			<Popover
				button={
					<FrameworkImage
						src="/astro-icon-light-gradient.svg"
						alt="Astro icon"
					/>
				}
				content={`Astro project${
					astroVersion ? ` (v${astroVersion})` : ""
				}`}
			/>
		) : null;
	const detectedFrameworkIcons = repositoryFrameworks
		.filter((framework) => info.framework !== framework.type)
		.map(renderFrameworkIcon);

	return (
		<span className="me-1 flex h-7 items-center justify-end gap-0 text-xs text-zinc-500">
			{upgradeIcons}
			{nextUpgrade}
			{frameworkIcon}
			{detectedFrameworkIcons}
			<Popover
				button={
					<svg
						aria-label="Vercel logomark"
						height="16"
						width="16"
						role="img"
						viewBox="0 0 74 64"
					>
						<path
							d="M37.5896 0.25L74.5396 64.25H0.639648L37.5896 0.25Z"
							fill="white"
						/>
					</svg>
				}
				content={`Vercel on node: ${info.nodeVersion || "unknown"}`}
			/>
			{details.isUsingTurbopack ? (
				<Popover
					button={
						<Image
							height={16}
							width={16}
							src="/turbo-benchmark-icon-dark.svg"
							alt="Turbo icon"
						/>
					}
					content="Using Turbopack"
				/>
			) : null}
			{(details.uiLibraries || []).map(renderUiLibrary)}
		</span>
	);
}

function renderFrameworkIcon(framework, index) {
	const iconMap = {
		nextjs: ["/nextjs-icon-dark.svg", "Next.js icon"],
		astro: ["/astro-icon-light-gradient.svg", "Astro icon"],
		nuxt: ["/nuxt-icon.svg", "Nuxt icon"],
		sveltekit: ["/sveltekit-icon.svg", "SvelteKit icon"],
		remix: ["/remix-icon.svg", "Remix icon"],
		gatsby: ["/gatsby-icon.svg", "Gatsby icon"],
	};
	const icon = iconMap[framework.type];

	if (!icon) {
		return null;
	}

	return (
		<Popover
			key={`framework-${framework.type}-${index}`}
			button={<FrameworkImage src={icon[0]} alt={icon[1]} />}
			content={`${framework.name}${
				framework.version ? ` (v${framework.version})` : ""
			}`}
		/>
	);
}

function renderUiLibrary(library) {
	const libraries = {
		tailwindcss: {
			icon: <RiTailwindCssFill aria-hidden="true" className="size-4" />,
			label: "Tailwind CSS",
		},
		"react-bootstrap": {
			icon: <SiReactbootstrap aria-hidden="true" className="size-4" />,
			label: "React Bootstrap",
		},
		primer: {
			icon: <span className="text-base">🛠</span>,
			label: "Primer",
		},
	};
	const config = libraries[library];

	if (!config) {
		return null;
	}

	return (
		<Popover
			key={library}
			button={config.icon}
			content={config.label}
		/>
	);
}

function FrameworkImage({ src, alt }) {
	return (
		<Image
			height={16}
			width={16}
			className="inline-block size-4"
			src={src}
			alt={alt}
		/>
	);
}
