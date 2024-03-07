import { Navigation } from "../components/nav";

export default async function Loading() {

	return (
		<div className="relative pb-16">
			<Navigation />
			<div className="px-6 pt-16 mx-auto space-y-8 max-w-7xl lg:px-8 md:space-y-12 md:pt-24 lg:pt-32">
				<div className="max-w-2xl mx-auto lg:mx-0">
					<h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
						Projects
					</h2>
				</div>

				<div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-32 w-32"></div>				
			</div>
		</div>
	);
}
