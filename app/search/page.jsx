import data from "../../data.json";
import { SearchPage } from "../user/_components/search-page";

const username = process.env.GITHUB_USERNAME || data.githubUsername;

export default function Search() {
	return <SearchPage initialUsername={username} />;
}
