# 🔗 [portfolio-jirihofman.vercel.app](https://portfolio-jirihofman.vercel.app)

My personal website, built with [Next.js](https://nextjs.org/), [Tailwind CSS](https://tailwindcss.com/), ~~[Upstash](https://upstash.com)~~ and deployed to preview(https://vercel.com/). Based on [chronark's site](https://chronark.com/).


## Running Locally


```sh-session
git clone https://github.com/jirihofman/portfolio.git
cd portfolio
```


Create a `.env` file similar to [`.env.example`](https://github.com/jirihofman/profile/blob/main/.env.example).
```sh
mv .env.example .env.local
```
Add GITHUB_TOKEN into the new file.
```sh
GITHUB_TOKEN=YOUR_GH_TOKEN
```

Then install dependencies and run the development server:
```sh-session
npm install
npm dev
```


## Cloning / Forking

Please remove all of my personal information (projects, images, etc.) before deploying your own version of this site.
