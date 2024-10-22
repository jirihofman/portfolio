'use client';

import React, { useState } from "react";
import { GoSearch } from 'react-icons/go';

const UserSearch = ({ user }) => {

    const [username, setUsername] = useState(user);
    const [userExists, setUserExists] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleUsernameChange = (e) => {
        setUsername(e.target.value);
        // Hacky way to reset userExists when username is changed.
        setUserExists(-1);
    };

    const handleSearch = async () => {
        setLoading(true);
        setUserExists(0);
        if (!username) {
            setLoading(false);
            return;
        }
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
                <div className="flex justify-end items-center relative">
                    <input
                        placeholder="Search GitHub"
                        type="text"
                        className="border border-gray-400 rounded-lg p-4 w-full"
                        value={username}
                        onChange={handleUsernameChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch();
                            }
                        }}
                    />
                    <span className="absolute mr-2 w-10 cursor-pointer" onClick={handleSearch}>
                        {loading ? '...' : <GoSearch size={32} />}
                    </span>
                </div>
            </div>

            {loading ? null :
                <>
                    {
                        userExists > 1 ?
                            <span className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-transparent bg-clip-text px-6">
                                <a href={`/?customUsername=${username}`}>
                                    Preview user: <span className="font-bold">{username}</span>
                                </a>
                            </span> :
                            <span className=" px-6">
                                {userExists !== -1 && newUsername && newUsername !== user ?
                                    <span className="text-red-500">User <strong>{newUsername}</strong> not found.</span> :
                                    <span className="inline-flex items-baseline text-zinc-500">
                                        <span className="pe-2">Click</span><GoSearch size={16} />
                                        <span className="ps-2">or pres <kbd>Enter</kbd> to search GitHub.</span>
                                    </span>}
                            </span>
                    }
                </>
            }
        </div>
    );
};

export default UserSearch;
