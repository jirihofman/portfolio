import { useId } from 'react';

const Popover = ({ button, content, label }) => {
	const tooltipId = useId();
	const accessibleLabel = label ?? (typeof content === 'string' ? content : undefined);

	return (
		<span className="group/popover relative inline-flex">
			<button
				type="button"
				aria-label={accessibleLabel}
				aria-describedby={tooltipId}
				className="inline-flex cursor-help items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"
			>
				{button}
			</button>
			<span
				id={tooltipId}
				role="tooltip"
				className="pointer-events-none invisible absolute right-1 top-full z-40 mt-2 w-48 rounded-lg border border-gray-300 bg-gray-300/90 p-2 text-sm text-black opacity-0 shadow-lg transition-opacity duration-150 group-hover/popover:visible group-hover/popover:opacity-100 group-focus-within/popover:visible group-focus-within/popover:opacity-100"
			>
				{content}
			</span>
		</span>
	);
};

export default Popover;
