const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		"./app/**/*.{js,jsx}",
		// "./mdx-components.tsx",
		// "content/**/*.mdx",
	],

	theme: {
		extend: {
			typography: {
				quoteless: {
					css: {
						"blockquote p:first-of-type::before": { content: "none" },
						"blockquote p:first-of-type::after": { content: "none" },
					},
				},
			},
			fontFamily: {
				sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
				display: ["var(--font-calsans)"],
			},
			backgroundImage: {
				"gradient-radial":
					"radial-gradient(50% 50% at 50% 50%, var(--tw-gradient-stops))",
			},
			animation: {
				"fade-in": "fade-in 320ms ease-out both",
				title: "title 420ms cubic-bezier(0.22, 1, 0.36, 1) both",
				"fade-left": "fade-left 420ms ease-out both",
				"fade-right": "fade-right 420ms ease-out both",
			},
			keyframes: {
				"fade-in": {
					"0%": {
						opacity: "1",
						transform: "translateY(0.25rem)",
					},
					"100%": {
						opacity: "1",
						transform: "translateY(0)",
					},
				},
				"fade-left": {
					"0%": {
						transform: "translateX(2rem)",
						opacity: "0",
					},
					"100%": {
						transform: "translateX(0)",
						opacity: "1",
					}
				},
				"fade-right": {
					"0%": {
						transform: "translateX(-2rem)",
						opacity: "0",
					},
					"100%": {
						transform: "translateX(0)",
						opacity: "1",
					}
				},
				title: {
					"0%": {
						opacity: "1",
						transform: "translateY(0.4rem) scale(0.98)",
					},
					"100%": {
						opacity: "1",
						transform: "translateY(0) scale(1)",
					},
				},
			},
		},
	},
	plugins: [],
};
