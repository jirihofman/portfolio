export const Card = ({ children, deferRender = false, className = '' }) => {
	return (
		<div className={`overflow-hidden relative duration-700 border rounded-xl hover:bg-zinc-800/10 group md:gap-8 hover:border-zinc-400/50 border-zinc-600 ${deferRender ? 'deferred-card' : ''} ${className}`}>
			{children}
		</div>
	);
};
