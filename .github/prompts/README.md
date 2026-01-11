# Portfolio Template Prompts

This directory contains prompts for AI agents to help customize and maintain this portfolio repository.

## Available Prompts

### `remove-template.md` - Remove Template Functionality

**Purpose:** After forking or cloning this repository, use this prompt to remove all template-specific functionality and prepare the repository for personal use.

**What it does:**
- Removes template reversion logic (`lib/setup.mjs`)
- Removes all references to the original author (jirihofman)
- Eliminates IS_TEMPLATE environment variable
- Cleans up README to focus on personal portfolio use
- Prepares repository for deployment without template features

**When to use:**
- After forking/cloning the repository for your own portfolio
- When you want to remove all template functionality
- Before customizing the portfolio with your own information

**How to use:**
1. Copy the contents of `remove-template.md`
2. Provide it to your AI agent (GitHub Copilot, Claude, GPT, etc.)
3. Review and approve the suggested changes
4. Update `data.json` with your personal information

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-username/portfolio.git
cd portfolio

# 2. Use the removal prompt with your AI agent
cat .github/prompts/remove-template.md
# Copy the output and provide it to your AI agent

# 3. Update your personal information
# Edit data.json with your GitHub username and preferences

# 4. Set up environment variables
cp .env.example .env.local
# Add your GitHub token to .env.local

# 5. Run the development server
npm install
npm run dev
```

## Contributing Prompts

If you have ideas for additional prompts that would help users customize this portfolio template, feel free to contribute them to this directory.
