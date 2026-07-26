"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { GoSearch } from "react-icons/go";
import {
	createUserPath,
	isValidGitHubUsername,
} from "../user/_lib/username";

const UserSearch = ({ user = "" }) => {
	const [username, setUsername] = useState(user);
	const [resolvedUsername, setResolvedUsername] = useState("");
	const [status, setStatus] = useState("idle");
	const [loading, setLoading] = useState(false);
	const activeSearch = useRef(null);

	useEffect(
		() => () => {
			activeSearch.current?.abort();
		},
		[],
	);

	const handleUsernameChange = (event) => {
		activeSearch.current?.abort();
		activeSearch.current = null;
		setUsername(event.target.value);
		setResolvedUsername("");
		setStatus("idle");
		setLoading(false);
	};

	const handleSearch = async () => {
		const candidate = username.trim();

		if (!isValidGitHubUsername(candidate)) {
			setResolvedUsername("");
			setStatus("invalid");
			return;
		}

		activeSearch.current?.abort();
		const controller = new AbortController();
		activeSearch.current = controller;
		setUsername(candidate);
		setLoading(true);
		setResolvedUsername("");
		setStatus("idle");

		try {
			const response = await fetch(
				`/api/users/${encodeURIComponent(candidate)}`,
				{ signal: controller.signal },
			);
			const userData = response.ok ? await response.json() : null;
			const found = Boolean(userData?.id);

			setResolvedUsername(found ? candidate : "");
			setStatus(found ? "found" : "not-found");
		} catch (error) {
			if (!controller.signal.aborted) {
				setResolvedUsername("");
				setStatus("not-found");
			}
		} finally {
			if (activeSearch.current === controller) {
				activeSearch.current = null;
				setLoading(false);
			}
		}
	};

	const previewHref =
		status === "found" ? createUserPath(resolvedUsername) : null;

	return (
		<div className="w-96 max-w-[100vw]">
			<div className="relative p-6 flex-auto">
				<label
					className="block text-white text-sm font-bold mb-1"
					htmlFor="username"
				>
					GitHub username
				</label>
				<div className="flex justify-end items-center relative">
					<input
						id="username"
						placeholder="Search GitHub"
						type="text"
						autoComplete="username"
						className="bg-gray-800 border border-gray-600 rounded-lg p-4 pe-14 w-full text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
						value={username}
						onChange={handleUsernameChange}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !loading) {
								handleSearch();
							}
						}}
					/>
					<button
						type="button"
						onClick={handleSearch}
						disabled={loading}
						className="absolute right-2 w-10 cursor-pointer disabled:cursor-wait"
						aria-label="Search GitHub users"
					>
						{loading ? "..." : <GoSearch size={32} />}
					</button>
				</div>
			</div>

			<div className="px-6" aria-live="polite" aria-atomic="true">
				{loading ? (
					<span className="text-zinc-400">Searching...</span>
				) : previewHref ? (
					<Link
						href={previewHref}
						className="bg-linear-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-transparent bg-clip-text"
					>
						Preview user:{" "}
						<span className="font-bold">{resolvedUsername}</span>
					</Link>
				) : status === "invalid" ? (
					<span className="text-red-500">
						Enter a valid GitHub username.
					</span>
				) : status === "not-found" ? (
					<span className="text-red-500">
						User <strong>{username}</strong> not found.
					</span>
				) : (
					<span className="inline-flex items-baseline text-zinc-500">
						<span className="pe-2">Click</span>
						<GoSearch size={16} />
						<span className="ps-2">
							or press <kbd>Enter</kbd> to search GitHub.
						</span>
					</span>
				)}
			</div>
		</div>
	);
};

export default UserSearch;
