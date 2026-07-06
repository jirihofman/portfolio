# 🔗 [portfolio-jirihofman.vercel.app](https://portfolio-jirihofman.vercel.app)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?repository-url=https%3A%2F%2Fgithub.com%2Fjirihofman%2Fportfolio&env=GH_TOKEN,VC_TOKEN)

My personal portfolio website, built with [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/) and deployed to [Vercel](https://vercel.com/). Based on [chronark's site](https://chronark.com/). Some ideas borrowed from [leerob/leerob.io](https://github.com/leerob/leerob.io).

It is supposed to be used as a **template for other GitHub users' portfolios**. Data about user and projects are gathered via GitHub and Vercel API.

## Tech stack
- **Framework**: [Next.js](https://nextjs.org/) 16.2.10
- **Deployment**: [Vercel](https://vercel.com)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) 4.3.1
- **UI**: [React](https://react.dev/) 19.2.6
- **Icons**: [React Icons](https://react-icons.github.io/react-icons/) 5.7.0
- **Node.js**: 24.x

## Project Information Features

The portfolio automatically displays comprehensive information for each repository in the `/projects` page. Here's what visitors can expect to see for each project:

### Repository Details
- **Project name** with gradient styling and clickable links
- **Description** from GitHub repository
- **Creation date** showing when the project was started
- **Star count** with compact number formatting
- **GitHub repository link** for easy access to source code

### Repository Analytics (for your own repositories)
- **Visitor statistics**: Unique repository visitors in the last 14 days and today
- **Security alerts**: Dependabot alerts categorized by severity (critical, high, medium, low)
- **AI agent contributions**: Counts of merged GitHub Copilot pull requests and Codex contributions, including labeled PRs and co-authored commits

### Deployment & Technology Detection
- **Vercel integration**: Shows deployment status, Node.js version, and framework info
- **Framework detection**: 
  - Next.js projects with Pages Router, App Router, or hybrid detection
  - Turbopack usage indicator
  - Next.js version upgrade recommendations
- **UI library detection**: Automatically identifies Tailwind CSS, React Bootstrap, Primer, and other libraries from package.json

### Data Sources
- **GitHub API**: Repository information, traffic data, security alerts, pull requests, and AI agent contribution signals
- **Vercel API**: Deployment information and project details
- **GraphQL queries**: Pinned repositories, organization data, Copilot-authored merged pull requests, Codex-labeled merged pull requests, and Codex co-authored commits

All data is cached and refreshed automatically to ensure good performance while providing up-to-date information.

## Running Locally

```sh
git clone https://github.com/jirihofman/portfolio.git
cd portfolio
```

### Environment variables
Create a `.env.local` file similar to [`.env.example`](https://github.com/jirihofman/portfolio/blob/main/.env.example).
```sh
cp .env.example .env.local
```
Add your tokens to the `.env.local` file:
```sh
# Required: GitHub Personal Access Token (needed for build-time API calls to fetch user data)
GH_TOKEN=YOUR_GH_TOKEN

# Optional: Vercel token to display deployment information
VC_TOKEN=YOUR_VERCEL_TOKEN

# Optional: Set to false when using your own data in data.json
IS_TEMPLATE=true
```

**Note:** `GH_TOKEN` is **required** for the application to build and run. The build process makes GitHub API calls to fetch your username and repository data. Without a valid token, the build will fail.

Then install dependencies and run the development server:
```sh
# Install dependencies.
npm install
# Replace jirihofman's personal info with octocat's.
npm run setup
# Start hacking.
npm run dev
```

Edit `data.json` to put your personal information there.

## Cloning / Forking

When using this template for your own portfolio:

1. Run `npm run setup` to replace the default personal information in `data.json` with template data
2. Edit `data.json` with your own information (githubUsername, description, heroNames)
3. Set `IS_TEMPLATE=false` in your `.env.local` file to prevent future builds from reverting your changes
4. Update the following files with your information:
   - [ ] `README.md`: Update the link at the top
   - [ ] `app/layout.jsx`: Update metadata (title, description, favicon) - handled by `setup.mjs`
   - [ ] `public/favicon.ico`: Add your own favicon - handled by `setup.mjs`

### Removing Template Functionality

After cloning or forking this repository, you may want to remove all template-specific functionality and references to the original author. This will prepare the repository to be your own personal portfolio.

**Using GitHub Copilot, Codex, or another AI agent:**

If you have access to GitHub Copilot Workspace, Codex, or another AI coding agent, you can use the removal prompt:

```bash
# Copy the prompt content and provide it to your AI agent
cat .github/prompts/remove-template.prompt.md
```

The AI agent will:
- Remove template reversion logic from `lib/setup.mjs`
- Remove all references to jirihofman
- Eliminate IS_TEMPLATE environment variable usage
- Clean up README to focus on personal portfolio use
- Prepare the repository for your personal use without template features

**Manual Removal:**

If you prefer to remove template functionality manually, follow the detailed instructions in `.github/prompts/remove-template.md`.
