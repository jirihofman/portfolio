# Remove Template Functionality

This prompt instructs an AI agent to remove all template functionality from this portfolio repository after a user has cloned or forked it for their own use.

## How to Use This Prompt

**Option 1: GitHub Copilot Workspace**
1. Open GitHub Copilot Workspace
2. Copy the entire contents of this file
3. Paste it into the Copilot Workspace chat
4. Review and approve the suggested changes

**Option 2: GitHub Copilot Chat / Other AI Agents**
1. Open the AI agent in your IDE or terminal
2. Share this file with the AI agent or copy its contents
3. Ask the agent to: "Please follow the instructions in this file to remove all template functionality from this repository"
4. Review the changes before committing

**Option 3: Manual**
Follow the detailed instructions below to manually make each change.

## Objective

Remove all references to the original author (jirihofman), eliminate the template reversion logic, and prepare the repository to be a clean personal portfolio without template-specific features.

## Tasks to Complete

### 1. Remove Template Reversion Logic

**File: `lib/setup.mjs`**
- Remove the entire file OR modify it to only validate required environment variables
- This file currently reverts personal data back to template data, which should not happen after forking
- Consider either:
  - Deleting the file entirely and removing `npm run setup` from the build script
  - Converting it to a simple validation script that only checks for required environment variables

**File: `package.json`**
- If `lib/setup.mjs` is deleted, update the `build` script from `"npm run setup && next build"` to just `"next build"`
- Remove the `setup` script entry if the setup.mjs file is deleted

### 2. Remove jirihofman References

**File: `README.md`**
- Remove or replace the portfolio URL at the top: `# 🔗 [portfolio-jirihofman.vercel.app](https://portfolio-jirihofman.vercel.app)`
  - Replace with a generic placeholder like: `# Portfolio Template` or `# My GitHub Portfolio`
- Update the "Deploy with Vercel" button URL to remove the specific repository reference
  - Change from `https://github.com/jirihofman/portfolio` to a generic instruction
- Update the git clone command from `git clone https://github.com/jirihofman/portfolio.git` to a placeholder
- Remove the comment `# Replace jirihofman's personal info with octocat's.` from the setup instructions
- Remove the entire "Cloning / Forking" section as it's specific to the template functionality
- Update any other references to jirihofman's specific instance

**File: `app/projects/article.jsx`**
- Remove the commented-out line containing jirihofman (line 53):
  ```jsx
  {/* <Image src={`https://raw.githubusercontent.com/jirihofman/${project.name}/${project.default_branch}/public/favicon.ico`} alt={project.name} width={24} height={24} placeholder="blur-sm" /> */}
  ```

**File: `data.json`**
- If the githubUsername is still "jirihofman", replace it with a placeholder or empty string
- The current file shows "octocat" which is fine as a placeholder

### 3. Remove IS_TEMPLATE Environment Variable

**File: `.env.example`**
- Remove the `IS_TEMPLATE=true` line
- Remove any comments explaining IS_TEMPLATE functionality

**File: `README.md`**
- Remove all mentions of IS_TEMPLATE environment variable
- Remove instructions about setting `IS_TEMPLATE=false`

### 4. Clean Up Template-Specific Instructions

**File: `README.md`**
- Remove or simplify the "Cloning / Forking" section
- Remove warnings about template data being reverted
- Simplify to just basic setup instructions for a personal portfolio
- Keep the core instructions about setting up GitHub token and personal data

### 5. Update Documentation

**File: `README.md`**
- Update the description to remove "It is supposed to be used as a template for other GitHub users' portfolios" or make it past tense
- Update setup instructions to reflect that this is now a personal portfolio, not a template
- Keep useful information about what the portfolio does and how to run it
- Simplify the "Running Locally" section to remove template-specific steps

## Expected Outcome

After completing these tasks:
- The repository should be ready to use as a personal portfolio without reverting to template data
- No references to jirihofman should remain
- The IS_TEMPLATE environment variable should no longer be used
- The setup script should either be deleted or simplified to only validate environment variables
- The README should be clear and focused on personal portfolio use, not template distribution
- Users should be able to simply update `data.json` with their information and deploy

## Validation

After making changes:
1. Verify that no references to "jirihofman" remain (except in this prompt file and git history)
2. Verify that no references to "IS_TEMPLATE" remain (except in this prompt file)
3. Check that the README is clear and doesn't contain template-specific instructions
4. Ensure the build process still works without the template reversion logic
5. Confirm that `data.json` can be updated with personal information without being overwritten

## Notes

- Do NOT remove functionality related to fetching GitHub data, displaying projects, or the core portfolio features
- Do NOT remove the ability to use the portfolio - only remove the template reversion mechanism
- Preserve all attribution comments and credits to original authors (chronark, leerob) where they exist
- Keep the GitHub token requirement and Vercel integration - these are core features, not template functionality

## Example Changes

### Before: lib/setup.mjs
```javascript
if (process.env.IS_TEMPLATE === 'false') {
    // This means it's not the template, it's my legit site
    return;
}
if (dataJson.githubUsername !== 'jirihofman') {
    // This means it's not the template, it's someone's legit site
    return;
}
console.log('⚠️  This is still a template...');
```

### After: File Deleted
The entire `lib/setup.mjs` file should be deleted, and references to it removed from `package.json`.

---

### Before: README.md
```markdown
# 🔗 [portfolio-jirihofman.vercel.app](https://portfolio-jirihofman.vercel.app)

It is supposed to be used as a **template for other GitHub users' portfolios**.

git clone https://github.com/jirihofman/portfolio.git

# Replace jirihofman's personal info with octocat's.
npm run setup

Set `IS_TEMPLATE=false` in your `.env.local` file
```

### After: README.md
```markdown
# GitHub Portfolio

A Next.js portfolio website that automatically displays GitHub repository information.

git clone https://github.com/your-username/portfolio.git

# Install dependencies
npm install
```

---

### Before: .env.example
```
GH_TOKEN=
VC_TOKEN=
IS_TEMPLATE=true
```

### After: .env.example
```
GH_TOKEN=
VC_TOKEN=
```
