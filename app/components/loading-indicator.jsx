'use client'

import { useLinkStatus } from 'next/link'

export default function LoadingIndicator() {
	const { pending } = useLinkStatus()
	return pending ? (
		<div className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-400 animate-pulse"></div>
	) : null
}
