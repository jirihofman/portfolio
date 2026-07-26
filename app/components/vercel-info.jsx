import Image from 'next/image';
import Popover from './popover';
import { RiTailwindCssFill } from "react-icons/ri";
import { SiReactbootstrap } from 'react-icons/si';
import { MdUpgrade } from "react-icons/md";

/**
 * Compare semantic versions
 * @param {string} version1 - First version to compare
 * @param {string} version2 - Second version to compare
 * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
function compareVersions(version1, version2) {
    const parseVersion = (v) => {
        if (typeof v !== 'string') {
            return [0];
        }

        // Remove any leading 'v' and split by dots
        const cleaned = v.replace(/^v/, '').split('.');
        return cleaned.map(num => parseInt(num, 10) || 0);
    };
    
    const v1 = parseVersion(version1);
    const v2 = parseVersion(version2);
    
    const maxLength = Math.max(v1.length, v2.length);
    
    for (let i = 0; i < maxLength; i++) {
        const num1 = v1[i] || 0;
        const num2 = v2[i] || 0;
        
        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }
    
    return 0;
}

export const VercelInfo = ({ info }) => {
	const details = info.details || {};
	const nextjsLatestRelease = details.nextjsLatestRelease || {};
	const pJson = details.packageJson || null;
	const repositoryFrameworks = details.repositoryFrameworks || [];
	const isRouterPages = details.isRouterPages || false;
	const isRouterApp = details.isRouterApp || false;
	
	// Legacy Next.js handling for backward compatibility with Vercel framework detection
	const nextjsVersion = pJson?.dependencies?.next?.replace('^', '').replace('~', '');
	const astroVersion = pJson?.dependencies?.astro?.replace('^', '').replace('~', '') || pJson?.devDependencies?.astro?.replace('^', '').replace('~', '');

	let labelNext = 'Next.js project';
	let labelAstro = 'Astro project';

	if (info.framework === 'nextjs') {
		if (isRouterPages && isRouterApp) {
			labelNext = labelNext + ' using both Pages and App';
		} else if (isRouterPages && !isRouterApp) {
			labelNext = labelNext + ' using Pages';
		} else if (!isRouterPages && isRouterApp) {
			labelNext = labelNext + ' using App Router';
		} else if (!isRouterPages && !isRouterApp) {
			labelNext = labelNext + ' using neither Pages nor App Router';
		}
	}

	const isNext16 = nextjsVersion && compareVersions(nextjsVersion, '16.0.0') >= 0;
	let isUsingTurbopack = isNext16 || pJson?.scripts?.dev?.includes('--turbo') || false;
	const turboIcon = isUsingTurbopack
		? <Popover button={
			<Image 
				height={16}
				width={16}
				style={{ fontSize: 'medium' }}
				src='/turbo-benchmark-icon-dark.svg'
				alt='Turbo icon'
			/>
		} content="Using Turbopack" />
		: null;

	// Icons copied from https://vercel.com/design/brands

	// Upgrade icons for detected frameworks
	// Show upgrade icons for all frameworks that have upgrades available
	// Exclude Next.js when Vercel detects it (to avoid duplicate with legacyUpgradeIcon)
	const upgradeIcons = repositoryFrameworks
		.filter(framework => {
			if (!framework.hasUpgrade) return false;
			// Skip Next.js if Vercel detected it (legacy upgrade icon will handle it)
			if (framework.type === 'nextjs' && info.framework === 'nextjs') return false;
			return true;
		})
		.map((framework, index) => (
			<Popover 
				key={`upgrade-${framework.type}-${index}`}
				button={<MdUpgrade color='white' size={'20'} className='-mb-1' />} 
				label={`Upgrade available for ${framework.name}: ${framework.version} to ${framework.latestVersion}`}
				content={
					<>
						<strong className="block">Upgrade available</strong>
						<span>{framework.name}: {framework.version} ➡️ {framework.latestVersion}</span>
					</>
				} 
			/>
		));

	// Legacy upgrade icon for Next.js (for Vercel-detected projects)
	const legacyUpgradeIcon = info.framework === 'nextjs' && nextjsVersion && nextjsLatestRelease.tagName && compareVersions(nextjsVersion, nextjsLatestRelease.tagName) < 0
		? <Popover button={<MdUpgrade color='white' size={'20'} className='-mb-1' />} label={`Upgrade available for Next.js: ${nextjsVersion} to ${nextjsLatestRelease.tagName}`} content={<><strong className="block">Upgrade available</strong><span>Next.js: {nextjsVersion} ➡️ {nextjsLatestRelease.tagName}</span></>} />
		: null;

	const vercelIcon = <Popover button={<svg aria-label="Vercel logomark" height="16" width="16" role="img" style={{ width: '16px', height: '16px', overflow: 'visible' }} viewBox="0 0 74 64">
		<path d="M37.5896 0.25L74.5396 64.25H0.639648L37.5896 0.25Z" fill="white"></path>
	</svg>} content={'Vercel on node: ' + info.nodeVersion} />;

	// Framework icon logic for Next.js and Astro
	let frameworkIcon = null;
	if (info.framework === 'nextjs') {
		frameworkIcon = <Popover button={<FrameworkImage src="/nextjs-icon-dark.svg" alt="Next.js icon" />} content={labelNext + (nextjsVersion ? ` (v${nextjsVersion})` : '')} />;
	} else if (info.framework === 'astro') {
		frameworkIcon = <Popover button={
			<Image
				height={16}
				width={16}
				style={{ width: '16px', height: '16px', verticalAlign: 'middle', display: 'inline-block', margin: 0, padding: 0, overflow: 'visible' }}
				src="/astro-icon-light-gradient.svg"
				alt="Astro icon"
			/>
		} content={labelAstro + (astroVersion ? ` (v${astroVersion})` : '')} />;
	}

	// Render detected framework icons (for package.json based detection)
	// Filter out frameworks already detected by Vercel to avoid duplicates
	const filteredFrameworks = repositoryFrameworks.filter(framework => {
		// Don't show framework icon if Vercel already detected this framework
		return info.framework !== framework.type;
	});
	
	const detectedFrameworkIcons = filteredFrameworks.map((framework, index) => 
		renderFrameworkIcon(framework, index)
	);

	return (
		<span className="text-zinc-500 text-xs flex items-center gap-1 me-2">
			<span>{upgradeIcons}</span>
			<span>{legacyUpgradeIcon}</span>
			<span>{frameworkIcon}</span>
			<span>{detectedFrameworkIcons}</span>
			<span>{vercelIcon}</span>
			<span>{turboIcon}</span>
			<span>
				{getUILibrary(pJson).map((uiLib, index) => (
					<Popover key={index} button={uiLib.icon} content={uiLib.text} />
				)) || null}
			</span>
		</span>
	);
}

/**
 * Renders a framework icon with popover
 * @param {Object} framework - Framework object with type, name, version, etc.
 * @param {number} index - Index for React key
 * @returns {JSX.Element} Framework icon with popover
 */
function renderFrameworkIcon(framework, index) {
	const iconMap = {
		'nextjs': {
			image: "/nextjs-icon-dark.svg",
			alt: "Next.js icon"
		},
		'astro': {
			image: "/astro-icon-light-gradient.svg",
			alt: "Astro icon"
		},
		'nuxt': {
			image: "/nuxt-icon.svg",
			alt: "Nuxt icon"
		},
		'sveltekit': {
			image: "/sveltekit-icon.svg",
			alt: "SvelteKit icon"
		},
		'remix': {
			image: "/remix-icon.svg",
			alt: "Remix icon"
		},
		'gatsby': {
			image: "/gatsby-icon.svg",
			alt: "Gatsby icon"
		}
	};

	const iconConfig = iconMap[framework.type];
	if (!iconConfig) return null;

	const content = `${framework.name}${framework.version ? ` (v${framework.version})` : ''}`;

	const button = <FrameworkImage src={iconConfig.image} alt={iconConfig.alt} />;

	return (
		<Popover 
			key={`framework-${framework.type}-${index}`}
			button={button}
			content={content}
		/>
	);
}

function FrameworkImage({ src, alt }) {
	return (
		<Image
			height={16}
			width={16}
			style={{ width: '16px', height: '16px', verticalAlign: 'middle', display: 'inline-block', margin: 0, padding: 0, overflow: 'visible' }}
			src={src}
			alt={alt}
		/>
	);
}

// Note: Doesn't account for any directly imported UI libraries, only those that are listed in package.json.
function getUILibrary(pJson) {

	const uiLibIcons = [];

	if (!pJson) return uiLibIcons;

	if (pJson?.devDependencies?.tailwindcss) {
		uiLibIcons.push({icon: <RiTailwindCssFill />, text: 'Tailwind CSS'});
	}
	if (pJson?.dependencies && pJson.dependencies['react-bootstrap']) {
		uiLibIcons.push({icon: <SiReactbootstrap color='' />, text: 'React Bootstrap'});
	}
	if (pJson?.dependencies && pJson.dependencies['@primer/react']) {
		uiLibIcons.push({icon: <span className="text-2xl">🛠</span>, text: 'Primer'});
	}

	return uiLibIcons;
}
