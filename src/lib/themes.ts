export type ThemeName = 'red' | 'purple' | 'pink' | 'blue' | 'amber' | 'light-blue';

type ColorScheme = 'dark' | 'light';

type Theme = {
	scheme: ColorScheme;
	tokens: Record<string, string>;
};

export const DEFAULT_THEME: ThemeName = 'red';

const sharedTokens: Record<string, string> = {
	'diff-text': 'var(--text-2)',

	'diff-add-text': '#9de8b0',
	'diff-add-bg': '#071507',
	'diff-add-gutter-bg': '#0a1f0a',
	'diff-add-gutter-text': '#4a8f5a',
	'diff-add-strong': '#4ade80',

	'diff-del-text': '#e8a0a0',
	'diff-del-bg': '#1e0505',
	'diff-del-gutter-bg': '#2a0808',
	'diff-del-gutter-text': '#8f4a4a',
	'diff-del-strong': '#ef4444',

	'diff-incremental-add-bg': '#092724',
	'diff-incremental-add-gutter-bg': '#0d3530',
	'diff-incremental-add-text': '#76e6d5',
	'diff-incremental-del-bg': '#301805',
	'diff-incremental-del-gutter-bg': '#442208',
	'diff-incremental-del-text': '#f3b562',

	'diff-hunk-bg': '#0d1a0d',
	'diff-hunk-text': '#4a8f5a',

	'diff-untracked-text': '#c9a84c',
	'diff-untracked-bg': '#0f0e02',
	'diff-untracked-border': '#2a2508',

	'diff-highlight-bg': 'rgba(250, 220, 80, 0.28)',
	'diff-highlight-outline': 'rgba(250, 220, 80, 0.4)',

	success: '#86efac',
	'success-strong': '#4ade80',
	'success-border': '#2f6f4a',
	'success-bg': '#0e2417',

	warning: '#fbbf24',
	'warning-border': '#78571a',
	'warning-bg': '#241c07',

	changed: '#f3b562',
	'changed-strong': '#9a641c',
	'changed-border': '#6d4517',
	'changed-bg': '#241505',

	danger: '#fca5a5',

	'syntax-keyword': '#f472b6',
	'syntax-builtin': '#fb923c',
	'syntax-string': '#86efac',
	'syntax-number': '#67e8f9',
	'syntax-function': '#fbbf24',
	'syntax-type': '#c084fc',
	'syntax-property': '#93c5fd',
	'syntax-tag': '#f97316',
	'syntax-symbol': '#a3e635',

	'editor-keyword': '#e57373',
	'editor-string': '#c9a84c',
	'editor-number': '#d8956f',
	'editor-function': '#9de8b0',
	'editor-type': '#8fbcd4',
	'editor-property': '#d4a5a5'
};

const themes: Record<ThemeName, Theme> = {
	red: {
		scheme: 'dark',
		tokens: {
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
		}
	},
	purple: {
		scheme: 'dark',
		tokens: {
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
	},
	pink: {
		scheme: 'dark',
		tokens: {
			bg: '#0e040a',
			'bg-2': '#0b0308',
			surface: '#18080f',
			'surface-2': '#1e0b14',
			border: '#2d1220',
			'border-2': '#18080f',
			accent: '#ec4899',
			'accent-muted': '#831843',
			'accent-bg': '#2d0a1c',
			'accent-soft': 'rgba(236, 72, 153, 0.06)',
			text: '#f5eaf0',
			'text-2': '#e0c0d2',
			'text-muted': '#c488a8',
			'text-dim': '#a06084',
			'text-ghost': '#6e4058',
			'text-faint': '#3f2031',
			'diff-context-text': '#ffecf6'
		}
	},
	blue: {
		scheme: 'dark',
		tokens: {
			bg: '#04070e',
			'bg-2': '#03050b',
			surface: '#080d18',
			'surface-2': '#0b111e',
			border: '#12192d',
			'border-2': '#080d18',
			accent: '#3b82f6',
			'accent-muted': '#1e3a8a',
			'accent-bg': '#0a142d',
			'accent-soft': 'rgba(59, 130, 246, 0.06)',
			text: '#eaeff5',
			'text-2': '#c0cde0',
			'text-muted': '#88a0c4',
			'text-dim': '#6078a0',
			'text-ghost': '#40506e',
			'text-faint': '#20293f',
			'diff-context-text': '#ecf3ff'
		}
	},
	amber: {
		scheme: 'dark',
		tokens: {
			bg: '#0e0904',
			'bg-2': '#0b0703',
			surface: '#181008',
			'surface-2': '#1e150b',
			border: '#2d2012',
			'border-2': '#181008',
			accent: '#f59e0b',
			'accent-muted': '#78350f',
			'accent-bg': '#2d1b0a',
			'accent-soft': 'rgba(245, 158, 11, 0.06)',
			text: '#f5f0ea',
			'text-2': '#e0d2c0',
			'text-muted': '#c4a888',
			'text-dim': '#a08460',
			'text-ghost': '#6e5840',
			'text-faint': '#3f3120',
			'diff-context-text': '#fff6ec'
		}
	},
	'light-blue': {
		scheme: 'light',
		tokens: {
			bg: '#f4f8fc',
			'bg-2': '#eaf1f8',
			surface: '#ffffff',
			'surface-2': '#eef4fa',
			border: '#d3dfeb',
			'border-2': '#e6edf5',
			accent: '#2563eb',
			'accent-muted': '#93c5fd',
			'accent-bg': '#dbeafe',
			'accent-soft': 'rgba(37, 99, 235, 0.06)',
			text: '#0f1e2e',
			'text-2': '#1e3a5f',
			'text-muted': '#3d5a7a',
			'text-dim': '#5b7896',
			'text-ghost': '#8aa1b8',
			'text-faint': '#c3d1de',
			'diff-context-text': '#0f1e2e',

			'diff-add-text': '#14532d',
			'diff-add-bg': '#e8f7ec',
			'diff-add-gutter-bg': '#d4f0dc',
			'diff-add-gutter-text': '#3f7f52',
			'diff-add-strong': '#16a34a',

			'diff-del-text': '#7f1d1d',
			'diff-del-bg': '#fdecec',
			'diff-del-gutter-bg': '#f9d9d9',
			'diff-del-gutter-text': '#a14a4a',
			'diff-del-strong': '#dc2626',

			'diff-incremental-add-bg': '#e0f5f2',
			'diff-incremental-add-gutter-bg': '#c9ece6',
			'diff-incremental-add-text': '#115e59',
			'diff-incremental-del-bg': '#fdf0e0',
			'diff-incremental-del-gutter-bg': '#f8e0c2',
			'diff-incremental-del-text': '#9a4a0a',

			'diff-hunk-bg': '#eef6ee',
			'diff-hunk-text': '#3f7f52',

			'diff-untracked-text': '#8a6a0a',
			'diff-untracked-bg': '#fdf8e6',
			'diff-untracked-border': '#ecdfae',

			'diff-highlight-bg': 'rgba(250, 200, 40, 0.35)',
			'diff-highlight-outline': 'rgba(200, 150, 0, 0.5)',

			success: '#15803d',
			'success-strong': '#16a34a',
			'success-border': '#86c89c',
			'success-bg': '#e6f6ea',

			warning: '#a16207',
			'warning-border': '#e5c07b',
			'warning-bg': '#fdf5e2',

			changed: '#9a4a0a',
			'changed-strong': '#e0a060',
			'changed-border': '#efc89a',
			'changed-bg': '#fdf0e0',

			danger: '#b91c1c',

			'syntax-keyword': '#be185d',
			'syntax-builtin': '#c2410c',
			'syntax-string': '#15803d',
			'syntax-number': '#0e7490',
			'syntax-function': '#a16207',
			'syntax-type': '#7e22ce',
			'syntax-property': '#1d4ed8',
			'syntax-tag': '#c2410c',
			'syntax-symbol': '#4d7c0f',

			'editor-keyword': '#b91c1c',
			'editor-string': '#8a6a0a',
			'editor-number': '#b45309',
			'editor-function': '#15803d',
			'editor-type': '#0e7490',
			'editor-property': '#9f3a5a'
		}
	}
};

export function resolveThemeName(value: string | null | undefined): ThemeName {
	const name = value
		?.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-');
	return name && name in themes ? (name as ThemeName) : DEFAULT_THEME;
}

export function themeStyleTag(value: string | null | undefined): string {
	const theme = themes[resolveThemeName(value)];
	const declarations = Object.entries({ ...sharedTokens, ...theme.tokens })
		.map(([token, color]) => `--${token}: ${color};`)
		.join(' ');
	return `<style>:root { color-scheme: ${theme.scheme}; ${declarations} }</style>`;
}
