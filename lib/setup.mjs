import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import dataJson from '../data.json' assert { type: "json" };

const data = {
	description: "My octo projects",
	githubUsername: "octocat",
	avatarUrl: "",
	displayName: "",
	email: "",
	socials: {},
};

(async () => {
	dotenv.config({ path: path.join(process.cwd(), '.env') });
	dotenv.config({ path: path.join(process.cwd(), '.env.local') });

	if (!process.env.GH_TOKEN) {
		throw new Error('Please set GH_TOKEN in .env or .env.local');
	}
	if (process.env.IS_TEMPLATE === 'false') {
		// This means it's not the template, it's my legit site
		// I orderride the env variable for my site. This means that when
		// folks clone this repo for the first time, it will delete my personal content
		return;
	}
	if (dataJson.githubUsername !== 'jirihofman') {
		// This means it's not the template, it's someone's legit site
		return;
	}

	console.log('⚠️  This is still a template. Please update data.json file and set IS_TEMPLATE to false in .env.local to use this template');
	console.log('⚙️  Reverting personal data to template data...');

	// Remove favicon.ico
	const faviconPath = path.join(process.cwd(), 'public', 'favicon.ico');
	await fs.unlink(faviconPath);
	console.log('⚙️  Removed favicon.ico');

	// Open data.json, merge it with data for octocat and save it to disk.
	const dataPath = path.join(process.cwd(), 'data.json');
	const newData = { ...dataJson, ...data };
	// Write it back to disk.
	await fs.writeFile(dataPath, JSON.stringify(newData, null, 4));

	console.log('⚙️  Reverted to template data (using octocat).');
})();
