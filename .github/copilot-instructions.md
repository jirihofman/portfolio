# Portfolio - Next.js GitHub Portfolio Website

This is a Next.js 15.5.2 portfolio website that automatically displays GitHub repository information, Vercel deployment details, and user profile data. It uses the GitHub API and Vercel API to gather project data and serves as a template for other developers' portfolios.

**ALWAYS follow these instructions first and only fallback to additional search or bash commands when you encounter unexpected information that does not match what is documented here.**

## Critical Requirements

### GitHub Token Requirement
- **CRITICAL**: A valid GitHub personal access token is REQUIRED for the application to build and run
- The `next.config.mjs` file makes GitHub API calls at build time to fetch the username
- **WITHOUT a valid GH_TOKEN, builds and development server will fail with "Blocked by DNS monitoring proxy" errors**
- Set `GH_TOKEN=your_personal_access_token` in `.env.local` before attempting any build or run commands

### Environment Setup
- Copy the environment template: `cp .env.example .env.local`
- Add your GitHub token: `echo "GH_TOKEN=your_token_here" >> .env.local`
- Optionally add Vercel token for deployment info: `echo "VC_TOKEN=your_vercel_token" >> .env.local`
- For template mode: `echo "IS_TEMPLATE=false" >> .env.local`

## Working Effectively

### Initial Setup and Dependencies
- **Install dependencies**: `npm install` -- takes 10 seconds. NEVER CANCEL.
- **Setup template data**: `npm run setup` -- takes <1 second
- **Note**: npm install is fast and reliable, no special timeout needed

### Building the Application
- **Development build**: Not required, use dev server directly
- **Production build**: `npm run build` -- takes 20-30 seconds. NEVER CANCEL. Set timeout to 60+ minutes for safety.
- **Production build (no setup)**: `npm run build-only` -- takes 20-30 seconds. NEVER CANCEL.
- **CRITICAL**: Build WILL FAIL without valid GitHub token in environment

### Running the Application
- **Development server**: `npm run dev` -- starts in <1 second using Turbopack
  - Runs on http://localhost:3000
  - Uses Turbopack for fast hot reloading
  - **CRITICAL**: Requires valid GitHub token or will fail immediately
- **Production server**: `npm start` -- starts in <1 second
  - Must run `npm run build` first
  - May have routing issues if build was modified

### No Testing or Linting
- **No test suite exists** - this project has no automated tests
- **No linting configuration** - no ESLint, Prettier, or other code quality tools
- **No CI/CD workflows** - only Dependabot configuration exists
- **Do not attempt** to run `npm test`, `npm run lint`, or similar commands

## Application Architecture

### Framework and Structure
- **Next.js 15.5.2** with App Router (not Pages Router)
- **React 19.1.0** with modern React patterns
- **Tailwind CSS 4.1.12** for styling with custom animations
- **Turbopack** for fast development builds

### Key Directories
```
app/                  # App Router pages and components
├── components/       # Reusable React components
├── page.jsx         # Home page with user profile
├── projects/        # Projects listing page
├── contact/         # Contact information page
├── search/          # Search functionality
└── layout.jsx       # Root layout with metadata

pages/api/           # API routes (legacy Pages Router)
└── users/[username].js  # GitHub user data API

lib/                 # Utility functions and setup
└── setup.mjs        # Template setup script

public/             # Static assets
data.json           # User configuration and project settings
```

### Data Sources and APIs
- **GitHub API**: Repository information, user profiles, traffic data, security alerts
- **Vercel API**: Deployment information and project details (optional)
- **GraphQL**: For pinned repositories and organization data
- **API calls happen at build time** in next.config.mjs and runtime in components

## Validation Scenarios

### Manual Testing Requirements
Since there are no automated tests, ALWAYS manually validate changes by:

1. **Start the development server**: `npm run dev`
2. **Navigate to http://localhost:3000** and verify the homepage loads
3. **Test navigation**: Click "Projects" and "Contact" links
4. **Verify user data**: Confirm GitHub username and avatar display correctly
5. **Test search functionality**: Use the "Try yourself" feature to test other users
6. **Check project listings**: Verify repositories are fetched and displayed properly

### Expected Functionality
- **Homepage**: Displays GitHub username, avatar, bio, and organizations
- **Projects page**: Lists GitHub repositories with stats, deployments, and security info
- **Contact page**: Shows email and social media links from GitHub profile
- **Search feature**: Allows viewing other users' portfolios by GitHub username
- **Responsive design**: Works on mobile and desktop devices

## Configuration Files

### package.json Scripts
```json
{
  "dev": "next dev --turbopack",
  "build": "npm run setup && next build", 
  "build-only": "next build",
  "start": "next start",
  "setup": "node ./lib/setup.mjs"
}
```

### next.config.mjs Important Notes
- **Makes GitHub API call at build time** to fetch username
- **Requires valid GH_TOKEN environment variable**
- **Configures image domains** for GitHub avatars
- **Sets experimental staleTimes** for caching

### data.json Configuration
- **Personal information**: githubUsername, description, email
- **Project settings**: blacklist, heroNames for featured projects  
- **Modified by setup script** to use template data (octocat) when IS_TEMPLATE=true

## Common Issues and Solutions

### Build Failures
- **"Blocked by DNS monitoring proxy"**: Missing or invalid GitHub token
- **Solution**: Set valid GH_TOKEN in .env.local
- **API rate limiting**: GitHub token may have rate limits
- **Solution**: Use a personal access token with appropriate permissions

### Development Server Issues
- **Server won't start**: Usually missing GitHub token
- **Solution**: Check .env.local has valid GH_TOKEN
- **Port conflicts**: Default port 3000 may be in use
- **Solution**: Kill other processes or use different port

### Template vs Personal Site
- **Template mode**: IS_TEMPLATE=true (default) - uses octocat data
- **Personal mode**: IS_TEMPLATE=false - uses your data.json configuration
- **Setup script behavior**: Automatically reverts to template data if githubUsername=jirihofman

## Performance Expectations

### Command Timing (with adequate hardware)
- `npm install`: 10 seconds
- `npm run setup`: <1 second  
- `npm run build`: 20-30 seconds (requires GitHub API access)
- `npm run dev`: <1 second to start
- `npm start`: <1 second to start

### Build Optimization
- **Uses Turbopack** in development for fast rebuilds
- **Next.js static optimization** for production builds
- **Image optimization** for GitHub avatars and assets
- **Experimental staleTimes** for client-side caching

## Deployment Notes

### Vercel Deployment (Primary)
- **Designed for Vercel** deployment with automatic builds
- **Environment variables** must be set in Vercel dashboard
- **GitHub integration** for automatic deployments on push
- **Domain configuration** available through Vercel

### Environment Variables for Deployment
```bash
GH_TOKEN=your_github_personal_access_token
VC_TOKEN=your_vercel_token_optional  
IS_TEMPLATE=false
```

## File Structure for Quick Navigation

### Most Frequently Modified Files
- `data.json` - Personal information and project settings
- `app/page.jsx` - Homepage layout and content
- `app/projects/page.jsx` - Projects page structure
- `app/contact/page.jsx` - Contact information display
- `app/layout.jsx` - Site metadata and global layout
- `.env.local` - Environment configuration (not committed)

### Configuration Files
- `next.config.mjs` - Next.js configuration with GitHub API integration
- `tailwind.config.js` - Tailwind CSS custom theme and animations  
- `package.json` - Dependencies and npm scripts
- `.gitignore` - Git ignore patterns (includes .env.local)

### Key Components
- `app/components/nav.jsx` - Navigation component
- `app/components/card.jsx` - Reusable card component
- `app/data.js` - GitHub API integration functions
- `lib/setup.mjs` - Template setup and data migration

## Security Considerations

- **Never commit .env.local** - contains sensitive tokens
- **GitHub token permissions** - only needs public repository access for basic functionality
- **Vercel token** - optional, only needed for deployment information
- **No user authentication** - this is a public portfolio site
- **API rate limiting** - GitHub API has rate limits that may affect builds

This portfolio template prioritizes simplicity and GitHub integration over complex build tooling or testing infrastructure. Focus on content and configuration rather than development workflow when making changes.