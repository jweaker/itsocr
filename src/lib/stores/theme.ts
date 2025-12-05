/**
 * Theme store for dark mode management
 * Persists preference to localStorage
 */

import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

// Get initial theme from localStorage or default to light
function getInitialTheme(): Theme {
	if (!browser) return 'light';
	const stored = localStorage.getItem('theme');
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}
	// Check system preference for initial value
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Apply theme to document
function applyTheme(theme: Theme) {
	if (!browser) return;
	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}

// Simple reactive store
let _theme: Theme = getInitialTheme();

// Apply initial theme
if (browser) {
	applyTheme(_theme);
}

/**
 * Get current theme
 */
export function getTheme(): Theme {
	return _theme;
}

/**
 * Get resolved theme (same as getTheme now)
 */
export function getResolvedTheme(): Theme {
	return _theme;
}

/**
 * Set theme preference
 */
export function setTheme(theme: Theme) {
	_theme = theme;

	if (browser) {
		localStorage.setItem('theme', theme);
		applyTheme(theme);
	}
}

/**
 * Toggle between light and dark
 */
export function toggleTheme() {
	setTheme(_theme === 'dark' ? 'light' : 'dark');
}
