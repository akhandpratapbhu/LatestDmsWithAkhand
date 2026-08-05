/**
 * Project visual theme presets for Enterprise Builder workspaces.
 * Applied via `data-theme` + CSS variables on the app shell / project login.
 */

export const PROJECT_THEME_IDS = ['default', 'hospital', 'school', 'dms'] as const;

export type ProjectThemeId = (typeof PROJECT_THEME_IDS)[number];

/** Aliases stored historically or preferred by product naming. */
const THEME_ALIASES: Record<string, ProjectThemeId> = {
  default: 'default',
  enterprise: 'default',
  ocean: 'default',
  forest: 'default',
  slate: 'default',
  sunrise: 'default',
  hospital: 'hospital',
  medical: 'hospital',
  clinical: 'hospital',
  school: 'school',
  education: 'school',
  academic: 'school',
  dms: 'dms',
  dealer: 'dms',
  mahindra: 'dms',
  automotive: 'dms',
  industrial: 'dms',
};

export type ProjectThemeTokens = {
  id: ProjectThemeId;
  label: string;
  description: string;
  /** Default primary when org/login does not override `primaryColor`. */
  primaryColor: string;
  /** CSS custom properties applied at runtime (and mirrored in global.css). */
  cssVars: Record<string, string>;
};

export const PROJECT_THEME_PRESETS: Record<ProjectThemeId, ProjectThemeTokens> = {
  default: {
    id: 'default',
    label: 'Enterprise',
    description: 'Polished neutral builder chrome with teal accent',
    primaryColor: '#0f766e',
    cssVars: {
      '--bg': '#eef1f6',
      '--bg-sidebar': '#0b1220',
      '--bg-header': '#ffffff',
      '--panel': '#ffffff',
      '--ink': '#0f172a',
      '--ink-soft': '#1e293b',
      '--muted': '#64748b',
      '--line': '#e2e8f0',
      '--line-strong': '#cbd5e1',
      '--accent': '#0f766e',
      '--accent-strong': '#0d5f59',
      '--accent-soft': '#ccfbf1',
      '--accent-ring': 'rgba(15, 118, 110, 0.22)',
      '--sidebar-text': '#94a3b8',
      '--sidebar-text-strong': '#f8fafc',
      '--sidebar-active': 'rgba(20, 184, 166, 0.14)',
      '--sidebar-active-text': '#5eead4',
      '--sidebar-active-bar': '#14b8a6',
      '--sidebar-border': '#1e293b',
      '--sidebar-env': '#5eead4',
      '--sidebar-env-bg': 'rgba(45, 212, 191, 0.12)',
      '--sidebar-env-border': 'rgba(45, 212, 191, 0.25)',
      '--brand-badge-from': '#14b8a6',
      '--brand-badge-to': '#0f766e',
      '--table-head': '#f8fafc',
      '--table-zebra': '#f8fafc',
      '--table-hover': '#f1f5f9',
      '--toolbar-bg': '#f8fafc',
    },
  },
  hospital: {
    id: 'hospital',
    label: 'Hospital',
    description: 'Clinical whites with medical teal and calm trust',
    primaryColor: '#0d9488',
    cssVars: {
      '--bg': '#f3f7f8',
      '--bg-sidebar': '#0c1c22',
      '--bg-header': '#ffffff',
      '--panel': '#ffffff',
      '--ink': '#0f1c24',
      '--ink-soft': '#1e3340',
      '--muted': '#5b7380',
      '--line': '#dce8ec',
      '--line-strong': '#c5d6dc',
      '--accent': '#0d9488',
      '--accent-strong': '#0f766e',
      '--accent-soft': '#ccfbf1',
      '--accent-ring': 'rgba(13, 148, 136, 0.24)',
      '--sidebar-text': '#9db4bc',
      '--sidebar-text-strong': '#f4fbfb',
      '--sidebar-active': 'rgba(45, 212, 191, 0.14)',
      '--sidebar-active-text': '#5eead4',
      '--sidebar-active-bar': '#2dd4bf',
      '--sidebar-border': '#163038',
      '--sidebar-env': '#5eead4',
      '--sidebar-env-bg': 'rgba(45, 212, 191, 0.12)',
      '--sidebar-env-border': 'rgba(45, 212, 191, 0.28)',
      '--brand-badge-from': '#2dd4bf',
      '--brand-badge-to': '#0d9488',
      '--table-head': '#eef6f7',
      '--table-zebra': '#f7fbfb',
      '--table-hover': '#e6f4f3',
      '--toolbar-bg': '#eef6f7',
      '--danger': '#c81e1e',
      '--danger-soft': '#fee2e2',
    },
  },
  school: {
    id: 'school',
    label: 'School',
    description: 'Academic navy with warm gold accent',
    primaryColor: '#b45309',
    cssVars: {
      '--bg': '#f2f4f8',
      '--bg-sidebar': '#0b1a33',
      '--bg-header': '#ffffff',
      '--panel': '#ffffff',
      '--ink': '#0c1526',
      '--ink-soft': '#1e293b',
      '--muted': '#64748b',
      '--line': '#e2e8f0',
      '--line-strong': '#cbd5e1',
      '--accent': '#b45309',
      '--accent-strong': '#92400e',
      '--accent-soft': '#fef3c7',
      '--accent-ring': 'rgba(180, 83, 9, 0.22)',
      '--sidebar-text': '#a8b8d0',
      '--sidebar-text-strong': '#f8fafc',
      '--sidebar-active': 'rgba(251, 191, 36, 0.12)',
      '--sidebar-active-text': '#fbbf24',
      '--sidebar-active-bar': '#f59e0b',
      '--sidebar-border': '#152744',
      '--sidebar-env': '#fbbf24',
      '--sidebar-env-bg': 'rgba(251, 191, 36, 0.12)',
      '--sidebar-env-border': 'rgba(251, 191, 36, 0.28)',
      '--brand-badge-from': '#f59e0b',
      '--brand-badge-to': '#b45309',
      '--table-head': '#f1f5f9',
      '--table-zebra': '#f8fafc',
      '--table-hover': '#eef2ff',
      '--toolbar-bg': '#f1f5f9',
    },
  },
  dms: {
    id: 'dms',
    label: 'Dealer / DMS',
    description: 'Industrial charcoal with steel blue and amber',
    primaryColor: '#3b82a0',
    cssVars: {
      '--bg': '#eceff3',
      '--bg-sidebar': '#121417',
      '--bg-header': '#f8fafc',
      '--panel': '#ffffff',
      '--ink': '#111827',
      '--ink-soft': '#1f2937',
      '--muted': '#6b7280',
      '--line': '#dde3ea',
      '--line-strong': '#c5ced8',
      '--accent': '#3b82a0',
      '--accent-strong': '#2c657c',
      '--accent-soft': '#e0f2fe',
      '--accent-ring': 'rgba(59, 130, 160, 0.24)',
      '--sidebar-text': '#9ca3af',
      '--sidebar-text-strong': '#f3f4f6',
      '--sidebar-active': 'rgba(245, 158, 11, 0.12)',
      '--sidebar-active-text': '#fbbf24',
      '--sidebar-active-bar': '#f59e0b',
      '--sidebar-border': '#1f242b',
      '--sidebar-env': '#fbbf24',
      '--sidebar-env-bg': 'rgba(245, 158, 11, 0.12)',
      '--sidebar-env-border': 'rgba(245, 158, 11, 0.3)',
      '--brand-badge-from': '#f59e0b',
      '--brand-badge-to': '#3b82a0',
      '--table-head': '#eef2f6',
      '--table-zebra': '#f7f9fb',
      '--table-hover': '#e8eef4',
      '--toolbar-bg': '#eef2f6',
      '--warn': '#d97706',
    },
  },
};

export type ProjectThemeOption = {
  id: ProjectThemeId;
  label: string;
  description: string;
};

/** Dropdown options for Create Project / settings. */
export const PROJECT_THEME_OPTIONS: ProjectThemeOption[] = PROJECT_THEME_IDS.map((id) => ({
  id,
  label: PROJECT_THEME_PRESETS[id].label,
  description: PROJECT_THEME_PRESETS[id].description,
}));

/** Normalize stored theme strings (including dealer/mahindra aliases) to a preset id. */
export function resolveProjectThemeId(raw?: string | null): ProjectThemeId {
  if (!raw) return 'default';
  const key = raw.trim().toLowerCase();
  return THEME_ALIASES[key] ?? 'default';
}

export function getProjectThemePreset(raw?: string | null): ProjectThemeTokens {
  return PROJECT_THEME_PRESETS[resolveProjectThemeId(raw)];
}

/** Hex primary → soft fill + focus ring for runtime overrides. */
export function primaryColorOverrides(primary: string): Record<string, string> {
  const hex = primary.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
    return {};
  }
  return {
    '--accent': hex,
    '--accent-strong': hex,
    '--accent-soft': `color-mix(in srgb, ${hex} 16%, white)`,
    '--accent-ring': `color-mix(in srgb, ${hex} 28%, transparent)`,
    '--brand-badge-from': hex,
    '--brand-badge-to': hex,
    '--sidebar-active-bar': hex,
    '--sidebar-active-text': hex,
    '--sidebar-env': hex,
    '--project-primary': hex,
  };
}

/**
 * Flat CSS variable map for a theme, optionally overridden by `primaryColor`.
 */
export function buildThemeCssVars(
  themeRaw?: string | null,
  primaryColor?: string | null,
): Record<string, string> {
  const preset = getProjectThemePreset(themeRaw);
  const vars = { ...preset.cssVars, '--project-primary': preset.primaryColor };
  if (primaryColor?.trim()) {
    Object.assign(vars, primaryColorOverrides(primaryColor.trim()));
  }
  return vars;
}
