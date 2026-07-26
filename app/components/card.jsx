export const Card = ({ children, className = '' }) => {
	return (
		<div className={`relative duration-700 border rounded-xl hover:bg-zinc-800/10 group md:gap-8 hover:border-zinc-400/50 border-zinc-600 ${className}`}>
			{children}
		</div>
	);
};
