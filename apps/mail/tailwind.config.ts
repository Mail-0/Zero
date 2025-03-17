import { default as flattenColorPalette } from 'tailwindcss/lib/util/flattenColorPalette';
import sharedConfig from '../../packages/tailwind-config/tailwind.config';
import * as defaultTheme from 'tailwindcss/defaultTheme';
import * as animate from 'tailwindcss-animate';
import type { Config } from 'tailwindcss';

export default {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
		'./app/**/*.{js,ts,jsx,tsx,mdx}',
	],
	presets: [sharedConfig],
	theme: {
		extend: {
			colors: {
				offsetDark: '#0A0A0A',
				offsetLight: '#F5F5F5',
				logout: '#D93036',
				subtleWhite: '#EAEAEA',
				subtleBlack: '#1F1F1F',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				skyBlue: '#0066FF',
				shinyGray: '#A1A1A1',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			fontFamily: {
				sans: ['Geist', ...defaultTheme.fontFamily.sans],
				mono: ['Geist_Mono', ...defaultTheme.fontFamily.mono],
			},
			keyframes: {
				'fade-up': {
					'0%': {
						transform: 'translateY(10px)',
					},
					'100%': {
						transform: 'translateY(0)',
					},
				},
				moveUp: {
					'0%': {
						transform: 'translateY(90px)',
						opacity: '0',
					},
					'100%': {
						transform: 'translateY(0)',
						opacity: '1',
					},
				},
				fadeIn: {
					'0%': {
						opacity: '0',
					},
					'100%': {
						opacity: '1',
					},
				},
				shine: {
					from: {
						backgroundPosition: '200% 0',
					},
					to: {
						backgroundPosition: '-200% 0',
					},
				},
				'shine-slow': {
					from: {
						backgroundPosition: '200% 0',
					},
					to: {
						backgroundPosition: '-200% 0',
					},
				},
				'accordion-down': {
					from: {
						height: '0',
					},
					to: {
						height: 'var(--radix-accordion-content-height)',
					},
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)',
					},
					to: {
						height: '0',
					},
				},
			},
			animation: {
				'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'move-up': 'moveUp 3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				'fade-in': 'fadeIn 3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
				shine: 'shine 4s linear infinite',
				'shine-slow': 'shine-slow 8s linear infinite',
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	plugins: [
		animate,
		addVariablesForColors,
		function ({ matchUtilities, theme }: any) {
			matchUtilities({ values: flattenColorPalette(theme('backgroundColor')), type: 'color' });
		},
	],
} satisfies Config;

function addVariablesForColors({ addBase, theme }: any) {
	const allColors = flattenColorPalette(theme('colors'));
	const newVars = Object.fromEntries(
		Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
	);

	addBase({
		':root': newVars,
	});
}
