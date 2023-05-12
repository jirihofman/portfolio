'use client';
import React, { useState } from "react";
import Link from "next/link";
import { Loader, Search } from "lucide-react";

const UserSearch = ({ user }) => {

	const [username, setUsername] = useState(user);
	const [userExists, setUserExists] = useState(false);
	const [loading, setLoading] = useState(false);

	const handleUsernameChange = (e) => {
		console.log("handleUsernameChange", e.target.value)
		setUsername(e.target.value);
		setUserExists(-1);
	};

	const handleSearch = async () => {
		setLoading(true);
		setUserExists(0);
		if (!username) return;
		const response = await fetch(`api/users/${username}`);
		const data = await response.json();
		setUserExists(data.id);
		setLoading(false);
	}

	const newUsername = username !== user && username;

	return (
		<div className='w-96'>
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
			<div className="flex items-center justify-start p-6 border-t border-solid border-zinc-500">
				<button className="text-white bg-zinc-500 hover:bg-zinc-700 focus:bg-zinc-700 text-sm px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1"
					onClick={handleSearch}
					disabled={loading}
				>
					{loading ? <Loader size={20} /> : <Search size={20} />}
				</button>
				{loading ? null :
					<div>
						{
							userExists > 1 ?
								<span className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-transparent bg-clip-text px-6">
									<Link href={`/?customUsername=${username}`}>
										Preview user: <span className="font-bold">{username}</span>
									</Link>
								</span> :
								<span className=" px-6">
									{userExists !== -1 && newUsername && newUsername !== user ?
										<span className="text-red-500">User <strong>{newUsername}</strong> not found.</span> :
										<span className="inline-flex items-baseline text-zinc-500">
											<span className="pe-2">Click</span><Search size={16} />
											<span className="ps-2">to search GitHub.</span>
										</span>}
								</span>
						}
					</div>
				}
			</div>
		</div>
	);
};

export default UserSearch;
