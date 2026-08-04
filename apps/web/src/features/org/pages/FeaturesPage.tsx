import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PLATFORM_FEATURE_CATALOG,
  type OrganizationDto,
  type PlatformFeatureCatalogItem,
} from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { PageHeader } from '../../../components/PageHeader';
import { useOrg } from '../org-context';

export function FeaturesPage() {
  const { currentOrg, patchCurrentOrg, refreshOrgs } = useOrg();
  const href = useWorkspaceHref();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const installed = useMemo(
    () => new Set(currentOrg?.enabledFeatures ?? []),
    [currentOrg?.enabledFeatures],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, PlatformFeatureCatalogItem[]>();
    for (const feature of PLATFORM_FEATURE_CATALOG) {
      const list = map.get(feature.category) ?? [];
      list.push(feature);
      map.set(feature.category, list);
    }
    return [...map.entries()];
  }, []);

  async function toggle(feature: PlatformFeatureCatalogItem) {
    if (!currentOrg || feature.comingSoon) return;
    setError(null);
    setMessage(null);
    setBusyId(feature.id);
    const installing = !installed.has(feature.id);
    try {
      const updated = await orgApi<OrganizationDto>(
        `/organizations/features/${installing ? 'install' : 'uninstall'}`,
        {
          method: 'POST',
          body: JSON.stringify({ featureId: feature.id }),
        },
      );
      patchCurrentOrg(updated);
      await refreshOrgs();
      setMessage(
        installing
          ? `${feature.name} installed — related sidebar menus are now visible.`
          : `${feature.name} uninstalled — related sidebar menus are hidden.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Features"
        description={
          currentOrg
            ? `Install or remove platform features for ${currentOrg.name}. Installed features control which sidebar menus appear.`
            : 'Select a project from Project Dashboard to manage features.'
        }
      />

      {!currentOrg ? (
        <p className="muted">
          <Link to="/app/projects">Go to Project Dashboard</Link>
        </p>
      ) : (
        <>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <div className="action-row" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Link className="btn secondary" to={href('/app/forms')}>
              Forms builder
            </Link>
            <Link className="btn secondary" to={href('/app/grids')}>
              Grids builder
            </Link>
            <Link className="btn ghost" to="/app/projects">
              Back to projects
            </Link>
          </div>

          {byCategory.map(([category, features]) => (
            <section key={category} className="feature-category">
              <h2>{category}</h2>
              <ul className="feature-grid">
                {features.map((feature) => {
                  const isOn = installed.has(feature.id);
                  return (
                    <li key={feature.id} className="feature-card">
                      <div className="feature-card-top">
                        <strong>{feature.name}</strong>
                        {feature.comingSoon ? (
                          <span className="alert project-status">Soon</span>
                        ) : isOn ? (
                          <span className="alert success project-status">Installed</span>
                        ) : (
                          <span className="alert project-status">Available</span>
                        )}
                      </div>
                      <p className="muted">{feature.description}</p>
                      {feature.menuPaths.length > 0 ? (
                        <p className="muted tiny">Menus: {feature.menuPaths.join(', ')}</p>
                      ) : (
                        <p className="muted tiny">No sidebar menus yet</p>
                      )}
                      <button
                        type="button"
                        className={`btn ${isOn ? 'ghost' : 'primary'} sm`}
                        disabled={!!feature.comingSoon || busyId === feature.id}
                        onClick={() => void toggle(feature)}
                      >
                        {feature.comingSoon
                          ? 'Coming soon'
                          : busyId === feature.id
                            ? 'Saving…'
                            : isOn
                              ? 'Uninstall'
                              : 'Install'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
