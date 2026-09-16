export type ThemeName = 'red' | 'purple';

export const DEFAULT_THEME: ThemeName = 'red';

const palettes: Record<ThemeName, Record<string, string>> = {
	red: {
		bg: '#0e0404',
		'bg-2': '#0b0303',
		surface: '#180808',
		'surface-2': '#1e0b0b',
		border: '#2d1212',
		'border-2': '#180808',
		accent: '#ef4444',
		'accent-muted': '#7f1d1d',
		'accent-bg': '#2d0a0a',
		'accent-soft': 'rgba(239, 68, 68, 0.06)',
		text: '#f5eaea',
		'text-2': '#e0c0c0',
		'text-muted': '#c48888',
		'text-dim': '#a06060',
		'text-ghost': '#6e4040',
		'text-faint': '#3f2020',
		'diff-context-text': '#ffecec'
	},
	purple: {
		bg: '#09040e',
		'bg-2': '#07030b',
		surface: '#110818',
		'surface-2': '#150b1e',
		border: '#20122d',
		'border-2': '#110818',
		accent: '#a855f7',
		'accent-muted': '#581c87',
		'accent-bg': '#1d0a2d',
		'accent-soft': 'rgba(168, 85, 247, 0.06)',
		text: '#f0eaf5',
		'text-2': '#d1c0e0',
		'text-muted': '#a888c4',
		'text-dim': '#8260a0',
		'text-ghost': '#59406e',
		'text-faint': '#31203f',
		'diff-context-text': '#f6ecff'
	}
};

export function resolveThemeName(value: string | null | undefined): ThemeName {
	const name = value?.trim().toLowerCase();
	return name && name in palettes ? (name as ThemeName) : DEFAULT_THEME;
}

export function themeStyleTag(value: string | null | undefined): string {
	const declarations = Object.entries(palettes[resolveThemeName(value)])
		.map(([token, color]) => `--${token}: ${color};`)
		.join(' ');
	return `<style>:root { ${declarations} }</style>`;
}
