// import { getUser } from '../../../app/data';

const users = async (req, res) => {

	const { username } = req.query;

	console.log("username", username)
	const response = await fetch('https://api.github.com/users/' + username, {
		headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
	});
	const data = await response.json();
	// const data = await getUser(username);
	console.log("asdasdada", data)
	return res.status(200).json(data);
};

export default users;
