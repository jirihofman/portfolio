# 🔗 [portfolio-jirihofman.vercel.app](https://portfolio-jirihofman.vercel.app)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?repository-url=https%3A%2F%2Fgithub.com%2Fjirihofman%2Fportfolio&env=GH_TOKEN,VC_TOKEN)

My personal portfolio website, built with [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/) and deployed to [Vercel](https://vercel.com/). Based on [chronark's site](https://chronark.com/). Some ideas borrowed from [leerob/leerob.io](https://github.com/leerob/leerob.io).

It is supposed to be used as a **template for other GitHub users' portfolios**. Data about user and projects are gathered via GitHub and Vercel API.

## Tech stack
- **Framework**: [Next.js](https://nextjs.org/) 16.2.12
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
# Optional but recommended: raises GitHub API rate limits and enables owner-only metrics
GH_TOKEN=YOUR_GH_TOKEN

# Optional: Vercel token to display deployment information
VC_TOKEN=YOUR_VERCEL_TOKEN

# Optional: Set to false when using your own data in data.json
IS_TEMPLATE=true
```

**Note:** The application can build and run without `GH_TOKEN` by using the username in `data.json` and unauthenticated GitHub API requests. Add a token for higher rate limits and owner-only data such as traffic and Dependabot metrics.

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
   - [ ] `vercel.json`: Select the function region closest to your visitors and upstream APIs

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

## AI usage (optional)

Set `OPENROUTER_MANAGEMENT_KEY` in `.env.local` and restart the dev server to enable `/ai-usage` and its navigation links on the main portfolio. Without a key, the page returns 404 and the links are hidden. Other GitHub profiles never display the owner's AI usage links.

Use an OpenRouter **management key**, not a standard inference key. The [activity API](https://openrouter.ai/docs/api/api-reference/analytics/get-user-activity) requires it and returns the last 30 completed UTC days. The key is used server-side for the activity endpoint and an aggregate analytics query for cached input tokens. Never use a `NEXT_PUBLIC_` variable or commit a key.

The public page shows model names, daily request counts, input/output/reasoning token counts, model shares, and active days. It excludes prompts, conversations, account/member details, endpoint and key identifiers, and all spending data. Reasoning tokens are already part of output tokens. Cached input tokens are shown when the analytics API provides a complete result; unavailable cache data is omitted, not reported as zero. Cached tokens are already included in input tokens. Only allowlisted aggregates are cached for six hours, with revalidation on a subsequent request; an already open page does not poll. The timestamp shows when the displayed data was fetched, without a cache-duration label. Activity API failures show a neutral unavailable state; analytics failures omit the cached-token row while keeping the rest of the page available. No additional key or browser setup is needed.

### Vercel configuration

Add `OPENROUTER_MANAGEMENT_KEY` in the portfolio project's **Settings → Environment Variables** before deploying this feature. Use a Sensitive variable for Production and Preview. Preview scope enables live statistics in PR deployments; omit that scope if previews should not access the account. Keep the value server-only and use the same management key as local development. Development can continue using the ignored `.env.local` file.

Environment changes apply to new deployments. Redeploy the relevant environment after adding, replacing, or removing the key so navigation and the page use the new configuration. Removing the variable disables the feature; it does not revoke the key at OpenRouter.

### Verification

Run `node --test lib/ai-usage.test.mjs` for date boundaries, aggregation, privacy filtering, and cached-token parsing (including zero, missing, invalid, and partial results). Run `npm run build-only` to validate the Next.js production build without running the template setup script. With the dev server running, open `/ai-usage` and check the daily totals and token breakdown; without a key, expect a 404.
