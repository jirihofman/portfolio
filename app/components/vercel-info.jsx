import Image from 'next/image';
import { getNextjsLatestRelease, getRepositoryPackageJson, checkAppJsxExistence } from '../data';
import Popover from './popover';

export const VercelInfo = async ({ info }) => {

	const nextjsLatestRelease = await getNextjsLatestRelease();
	const pJson = await getRepositoryPackageJson(info.owner.login, info.name);
	const { isRouterPages, isRouterApp } = await checkAppJsxExistence(info.owner.login, info.name);
	const nextjsVersion = pJson?.dependencies?.next.replace('^', '').replace('~', '');
	let labelNext = 'Next.js project';

	if (isRouterPages && isRouterApp) {
		labelNext = labelNext + ' using both Pages and App';
	} else if (isRouterPages && !isRouterApp) {
		labelNext = labelNext + ' using Pages';
	} else if (!isRouterPages && isRouterApp) {
		labelNext = labelNext + ' using App Router';
	} else if (!isRouterPages && !isRouterApp) {
		labelNext = labelNext + ' using neither Pages nor App Router';
	}

	let isUsingTurbopack = pJson?.scripts?.dev?.includes('--turbo') || false;
	const turboIcon = isUsingTurbopack
		? <Popover button={
			<Image 
				height={16}
				width={16}
				style={{ fontSize: 'medium' }}
				src='https://turbo.build/images/docs/pack/turbo-benchmark-icon-dark.svg'
				alt='Turbo icon'
			/>
		} content={<span>Using Turbopack</span>} />
		: null;

	// Icons copied from https://vercel.com/design/brands

	const upgradeIcon = info.framework === 'nextjs' && nextjsVersion && nextjsVersion < nextjsLatestRelease.tagName
		? <Popover button={<span style={{ fontSize: 'medium' }}>⏫</span>} content={<span><p><strong>Upgrade available</strong></p>Next.js: {nextjsVersion} ➡️ {nextjsLatestRelease.tagName}</span>} />
		: null;

	const vercelIcon = <Popover button={<svg aria-label="Vercel logomark" height="16" role="img" style={{ width: 'auto', overflow: 'visible' }} viewBox="0 0 74 64">
		<path d="M37.5896 0.25L74.5396 64.25H0.639648L37.5896 0.25Z" fill="white"></path>
	</svg>} content={'Vercel on node: ' + info.nodeVersion} />

	// Currently only Next.js
	const frameworkIcon = info.framework === 'nextjs'
		? <Popover button={<svg aria-label="Next.js logomark" data-theme="dark" height="16" role="img" viewBox="0 0 180 180" width="16">
			<mask height="180" maskUnits="userSpaceOnUse" style={{ maskType: 'alpha' }} width="180" x="0" y="0"><circle cx="90" cy="90" fill="black" r="90"></circle></mask><g mask="url(#:R0:mask0_408_134)"><circle cx="90" cy="90" data-circle="true" fill="black" r="90" stroke="white" strokeWidth="6px"></circle><path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#:R0:paint0_linear_408_134)"></path><rect fill="url(#:R0:paint1_linear_408_134)" height="72" width="12" x="115" y="54"></rect></g><defs><linearGradient gradientUnits="userSpaceOnUse" id=":R0:paint0_linear_408_134" x1="109" x2="144.5" y1="116.5" y2="160.5"><stop stopColor="white"></stop><stop offset="1" stopColor="white" stopOpacity="0"></stop></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id=":R0:paint1_linear_408_134" x1="121" x2="120.799" y1="54" y2="106.875"><stop stopColor="white"></stop><stop offset="1" stopColor="white" stopOpacity="0"></stop></linearGradient></defs>
		</svg>} content={labelNext} />
		: null;

	return (
		<span className="text-zinc-500 text-xs flex items-center gap-1">
			<span>{upgradeIcon}</span>
			<span>{frameworkIcon}</span>
			<span>{vercelIcon}</span>
			<span>{turboIcon}</span>
		</span>
	);
};
