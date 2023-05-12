'use client';
import React, { useEffect, useState } from "react";
import Link from "next/link";

const UserSearch = ({ user }) => {

	const [username, setUsername] = useState(user);
	const [userExists, setUserExists] = useState(false);

	useEffect(() => {
		handleSearch();
	}, [user]);

	const handleUsernameChange = (e) => {
		console.log("handleUsernameChange", e.target.value)
		setUsername(e.target.value);
		setUserExists(false);
	};

	const handleSearch = async () => {
		if (!username) return;
		const response = await fetch(`api/users/${username}`);
		const data = await response.json();
		setUserExists(data.id);
	}

	return (
		<>
			<div className="relative p-6 flex-auto">
				<label className="block text-white text-sm font-bold mb-1" htmlFor="username">
					GitHub username
				</label>
				<input
					type="search"
					id="username"
					className="shadow appearance-none border rounded w-full py-2 px-1 text-black"
					value={username}
					onChange={handleUsernameChange}
				/>
			</div>
			<div className="flex items-center justify-end p-6 border-t border-solid border-blueGray-200 rounded-b">
				<button className="text-white bg-zinc-500 hover:bg-zinc-700 focus:bg-zinc-700 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1"
					onClick={handleSearch}
				>
					Search
				</button>
				{
					userExists ? <Link
						href={`/?customUsername=${username}`}
						className="text-white bg-zinc-500 hover:bg-zinc-700 focus:bg-zinc-700 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1"
					>
						Preview user: {username}
					</Link> : <button className="text-white bg-zinc-500 hover:bg-zinc-700 focus:bg-zinc-700 font-bold uppercase text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1"
						disabled
						title="User doesn't exist"
					>not found</button>
				}
			</div>
		</>
	);
};

export default UserSearch;
