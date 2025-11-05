# 🔗 [portfolio-jirihofman.vercel.app](https://portfolio-jirihofman.vercel.app)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?repository-url=https%3A%2F%2Fgithub.com%2Fjirihofman%2Fportfolio&env=GH_TOKEN,VC_TOKEN)

My personal portfolio website, built with [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/) and deployed to [Vercel](https://vercel.com/). Based on [chronark's site](https://chronark.com/). Some ideas borrowed from [leerob/leerob.io](https://github.com/leerob/leerob.io).

It is supposed to be used as a **template for other GitHub users' portfolios**. Data about user and projects are gathered via GitHub and Vercel API.

## Tech stack
- **Framework**: [Next.js](https://nextjs.org/) 16.0.1
- **Deployment**: [Vercel](https://vercel.com)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) 4.1.12
- **UI**: [React](https://react.dev/) 19.2.0

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
- **AI assistance**: Count of merged Copilot pull requests in the last 2 weeks

### Deployment & Technology Detection
- **Vercel integration**: Shows deployment status, Node.js version, and framework info
- **Framework detection**: 
  - Next.js projects with Pages Router, App Router, or hybrid detection
  - Turbopack usage indicator
  - Next.js version upgrade recommendations
- **UI library detection**: Automatically identifies Tailwind CSS, React Bootstrap, Primer, and other libraries from package.json

### Data Sources
- **GitHub API**: Repository information, traffic data, security alerts, pull requests
- **Vercel API**: Deployment information and project details
- **GraphQL queries**: Pinned repositories and organization data

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
GH_TOKEN=YOUR_GH_TOKEN
# Optional: If you have Vercel projects, create a token here https://vercel.com/account/tokens to get more info.
VC_TOKEN=YOUR_VERCEL_TOKEN
# Optional: Set to false when using your own data
IS_TEMPLATE=true
```

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

Please remove all of my personal information in `data.json` before deploying your own version of this site by running `npm run setup`. Once you are happy with your `data.json`, set `IS_TEMPLATE=false` in your `.env.local` file to prevent `npm run build` from reverting `data.json` back to Octocat's data.

### To check before deploying
- [ ] `data.json`: githubUsername, description, heroNames. Handled by `setup.mjs`.
- [ ] `README.md`: link at the top
- [ ] `app/layout.jsx`: metadata - title, description, favicon. Handled by `setup.mjs`.
- [ ] `public/favicon.ico`. Handled by `setup.mjs`.
