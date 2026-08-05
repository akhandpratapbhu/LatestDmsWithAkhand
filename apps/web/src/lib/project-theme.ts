import {
  buildThemeCssVars,
  resolveProjectThemeId,
  type ProjectThemeId,
} from '@dms/shared';
import { useEffect, useMemo } from 'react';

const THEME_VAR_KEYS = new Set([
  '--bg',
  '--bg-sidebar',
  '--bg-header',
  '--panel',
  '--ink',
  '--ink-soft',
  '--muted',
  '--line',
  '--line-strong',
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--accent-ring',
  '--sidebar-text',
  '--sidebar-text-strong',
  '--sidebar-active',
  '--sidebar-active-text',
  '--sidebar-active-bar',
  '--sidebar-border',
  '--sidebar-env',
  '--sidebar-env-bg',
  '--sidebar-env-border',
  '--brand-badge-from',
  '--brand-badge-to',
  '--table-head',
  '--table-zebra',
  '--table-hover',
  '--toolbar-bg',
  '--danger',
  '--danger-soft',
  '--warn',
  '--project-primary',
]);

export function applyThemeToElement(
  el: HTMLElement | null,
  themeRaw?: string | null,
  primaryColor?: string | null,
): ProjectThemeId {
  const themeId = resolveProjectThemeId(themeRaw);
  if (!el) return themeId;

  el.dataset.theme = themeId;
  const vars = buildThemeCssVars(themeId, primaryColor);
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
  return themeId;
}

export function clearThemeOverrides(el: HTMLElement | null) {
  if (!el) return;
  delete el.dataset.theme;
  for (const key of THEME_VAR_KEYS) {
    el.style.removeProperty(key);
  }
}

/**
 * Apply project theme to `document.documentElement` while mounted.
 * Platform shell should pass theme=`default` so /app stays neutral.
 */
export function useDocumentTheme(themeRaw?: string | null, primaryColor?: string | null) {
  const themeId = useMemo(() => resolveProjectThemeId(themeRaw), [themeRaw]);

  useEffect(() => {
    const root = document.documentElement;
    applyThemeToElement(root, themeId, primaryColor);
    return () => {
      clearThemeOverrides(root);
      root.dataset.theme = 'default';
    };
  }, [themeId, primaryColor]);

  return themeId;
}
