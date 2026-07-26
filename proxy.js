import { NextResponse } from "next/server";
import { createUserPath } from "./app/user/_lib/username";

const LEGACY_ROUTE_SUFFIXES = {
	"/": "",
	"/projects": "/projects",
	"/contact": "/contact",
	"/search": "/search",
};

export function proxy(request) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return NextResponse.next();
	}

	const url = request.nextUrl.clone();
	const legacyRouteSuffix = LEGACY_ROUTE_SUFFIXES[url.pathname];

	if (legacyRouteSuffix === undefined) {
		return NextResponse.next();
	}

	const legacyUsername = url.searchParams.get("customUsername")?.trim();
	const userPath = createUserPath(legacyUsername);
	url.searchParams.delete("customUsername");

	if (userPath) {
		url.pathname = `${userPath}${legacyRouteSuffix}`;
	}

	return NextResponse.redirect(url, 308);
}

export const config = {
	matcher: [
		{
			source: "/",
			has: [{ type: "query", key: "customUsername" }],
		},
		{
			source: "/projects",
			has: [{ type: "query", key: "customUsername" }],
		},
		{
			source: "/contact",
			has: [{ type: "query", key: "customUsername" }],
		},
		{
			source: "/search",
			has: [{ type: "query", key: "customUsername" }],
		},
	],
};
