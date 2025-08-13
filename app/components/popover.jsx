'use client';
import { useState } from 'react';

const Popover = ({ button, content }) => {
	const [isHovered, setIsHovered] = useState(false);

	const handleMouseEnter = () => {
		setIsHovered(true);
	};

	const handleMouseLeave = () => {
		setIsHovered(false);
	};

	return (
		<div className="relative">
			<span
				role="button"
				tabIndex={-1}
				className="items-center cursor-pointer"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				{button}
			</span>
			{isHovered && (
				<div className="absolute right-1 mt-2 w-48 bg-gray-300 bg-opacity-90 border border-gray-300 rounded-lg shadow-lg z-40">
					<div className="p-2 text-sm text-black">
						{content}
					</div>
				</div>
			)}
		</div>
	);
};

export default Popover;
