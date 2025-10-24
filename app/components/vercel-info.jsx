import Image from 'next/image';
import { getNextjsLatestRelease, getRepositoryPackageJson, checkAppJsxExistence, getRepositoryFrameworks } from '../data';
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

export const VercelInfo = async ({ info }) => {

	// Try to get real data, fall back gracefully if APIs fail
	let nextjsLatestRelease, pJson, repositoryFrameworks = [], isRouterPages = false, isRouterApp = false;
	
	try {
		nextjsLatestRelease = await getNextjsLatestRelease();
		pJson = await getRepositoryPackageJson(info.owner.login, info.name);
		const routerInfo = await checkAppJsxExistence(info.owner.login, info.name);
		isRouterPages = routerInfo.isRouterPages;
		isRouterApp = routerInfo.isRouterApp;
		repositoryFrameworks = await getRepositoryFrameworks(info.owner.login, info.name);
	} catch (error) {
		console.log('API error, falling back gracefully:', error.message);
		// Fallback to empty data - component will still show Vercel info
		nextjsLatestRelease = {};
		pJson = null;
		repositoryFrameworks = [];
	}
	
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
				src='turbo-benchmark-icon-dark.svg'
				alt='Turbo icon'
			/>
		} content={<span>Using Turbopack</span>} />
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
				content={
					<span>
						<p><strong>Upgrade available</strong></p>
						{framework.name}: {framework.version} ➡️ {framework.latestVersion}
					</span>
				} 
			/>
		));

	// Legacy upgrade icon for Next.js (for Vercel-detected projects)
	const legacyUpgradeIcon = info.framework === 'nextjs' && nextjsVersion && compareVersions(nextjsVersion, nextjsLatestRelease.tagName) < 0
		? <Popover button={<MdUpgrade color='white' size={'20'} className='-mb-1' />} content={<span><p><strong>Upgrade available</strong></p>Next.js: {nextjsVersion} ➡️ {nextjsLatestRelease.tagName}</span>} />
		: null;

	const vercelIcon = <Popover button={<svg aria-label="Vercel logomark" height="16" width="16" role="img" style={{ width: '16px', height: '16px', overflow: 'visible' }} viewBox="0 0 74 64">
		<path d="M37.5896 0.25L74.5396 64.25H0.639648L37.5896 0.25Z" fill="white"></path>
	</svg>} content={'Vercel on node: ' + info.nodeVersion} />;

	// Framework icon logic for Next.js and Astro
	let frameworkIcon = null;
	if (info.framework === 'nextjs') {
		frameworkIcon = <Popover button={<svg aria-label="Next.js logomark" data-theme="dark" height="16" role="img" viewBox="0 0 180 180" width="16">
			<mask height="180" maskUnits="userSpaceOnUse" style={{ maskType: 'alpha' }} width="180" x="0" y="0"><circle cx="90" cy="90" fill="black" r="90"></circle></mask><g mask="url(#:R0:mask0_408_134)"><circle cx="90" cy="90" data-circle="true" fill="black" r="90" stroke="white" strokeWidth="6px"></circle><path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#:R0:paint0_linear_408_134)"></path><rect fill="url(#:R0:paint1_linear_408_134)" height="72" width="12" x="115" y="54"></rect></g><defs><linearGradient gradientUnits="userSpaceOnUse" id=":R0:paint0_linear_408_134" x1="109" x2="144.5" y1="116.5" y2="160.5"><stop stopColor="white"></stop><stop offset="1" stopColor="white" stopOpacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id=":R0:paint1_linear_408_134" x1="121" x2="120.799" y1="54" y2="106.875"><stop stopColor="white"></stop><stop offset="1" stopColor="white" stopOpacity="0"></stop></linearGradient></defs>
		</svg>} content={labelNext + (nextjsVersion ? ` (v${nextjsVersion})` : '')} />;
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
			svg: <svg aria-label="Next.js logomark" data-theme="dark" height="16" role="img" viewBox="0 0 180 180" width="16">
				<mask height="180" maskUnits="userSpaceOnUse" style={{ maskType: 'alpha' }} width="180" x="0" y="0"><circle cx="90" cy="90" fill="black" r="90"></circle></mask><g mask="url(#:R0:mask0_408_134)"><circle cx="90" cy="90" data-circle="true" fill="black" r="90" stroke="white" strokeWidth="6px"></circle><path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#:R0:paint0_linear_408_134)"></path><rect fill="url(#:R0:paint1_linear_408_134)" height="72" width="12" x="115" y="54"></rect></g><defs><linearGradient gradientUnits="userSpaceOnUse" id=":R0:paint0_linear_408_134" x1="109" x2="144.5" y1="116.5" y2="160.5"><stop stopColor="white"></stop><stop offset="1" stopColor="white" stopOpacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id=":R0:paint1_linear_408_134" x1="121" x2="120.799" y1="54" y2="106.875"><stop stopColor="white"></stop><stop offset="1" stopColor="white" stopOpacity="0"></stop></linearGradient></defs>
			</svg>
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

	const button = iconConfig.svg ? iconConfig.svg : (
		<Image
			height={16}
			width={16}
			style={{ width: '16px', height: '16px', verticalAlign: 'middle', display: 'inline-block', margin: 0, padding: 0, overflow: 'visible' }}
			src={iconConfig.image}
			alt={iconConfig.alt}
		/>
	);

	return (
		<Popover 
			key={`framework-${framework.type}-${index}`}
			button={button}
			content={content}
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
