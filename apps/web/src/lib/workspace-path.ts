import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { resolveAppHref } from '@dms/shared';
import { useOrg } from '../features/org/org-context';

/** Prefer URL project slug; fall back to the selected org's slug. */
export function useProjectSlug(): string | null {
  const { projectSlug } = useParams<{ projectSlug?: string }>();
  const { currentOrg } = useOrg();
  const fromParams = projectSlug?.trim();
  if (fromParams) return fromParams;
  return currentOrg?.slug?.trim() || null;
}

/** Resolve canonical `/app/...` paths to project-scoped (or platform) hrefs. */
export function useWorkspaceHref(): (appPath: string) => string {
  const slug = useProjectSlug();
  return useMemo(() => (appPath: string) => resolveAppHref(appPath, slug), [slug]);
}
