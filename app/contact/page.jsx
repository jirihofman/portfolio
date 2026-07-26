import data from "../../data.json";
import { ContactPage } from "../user/_components/contact-page";

const username = process.env.GITHUB_USERNAME || data.githubUsername;

export default function Contacts() {
	return <ContactPage username={username} />;
}
