import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  featureSubscribeAppPath,
  isProtectedProjectFeature,
  PLATFORM_FEATURE_CATALOG,
  type OrganizationDto,
  type PlatformFeatureCatalogItem,
} from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { PageHeader } from '../../../components/PageHeader';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../org-context';

export function FeaturesPage() {
  const { currentOrg, patchCurrentOrg, refreshOrgs } = useOrg();
  const { user } = useAuth();
  const href = useWorkspaceHref();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const installed = useMemo(
    () => new Set(currentOrg?.enabledFeatures ?? []),
    [currentOrg?.enabledFeatures],
  );
  const subscribed = useMemo(
    () => new Set(currentOrg?.featureSubscriptions ?? []),
    [currentOrg?.featureSubscriptions],
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

  function canUninstall(feature: PlatformFeatureCatalogItem): boolean {
    if (!isProtectedProjectFeature(feature.id)) return true;
    return Boolean(user?.isPlatformAdmin);
  }

  async function toggle(feature: PlatformFeatureCatalogItem) {
    if (!currentOrg || feature.comingSoon) return;
    const installing = !installed.has(feature.id);
    if (!installing && !canUninstall(feature)) {
      setError(
        `${feature.name} is a core project feature. Only a platform admin can uninstall it.`,
      );
      return;
    }
    setError(null);
    setMessage(null);
    setBusyId(feature.id);
    try {
      const updated = await orgApi<OrganizationDto>(
        `/organizations/features/${installing ? 'install' : 'uninstall'}`,
        {
          method: 'POST',
          body: JSON.stringify({ featureId: feature.id }),
          organizationId: currentOrg.id,
        },
      );
      patchCurrentOrg(updated);
      await refreshOrgs(currentOrg.id);
      setMessage(
        installing
          ? feature.requiresSubscription
            ? `${feature.name} installed — open Subscription to enable full access.`
            : `${feature.name} installed — related sidebar menus are now visible.`
          : `${feature.name} uninstalled — related sidebar menus are hidden.`,
      );
      if (installing && feature.requiresSubscription) {
        navigate(href(featureSubscribeAppPath(feature.id)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feature');
    } finally {
      setBusyId(null);
    }
  }

  async function subscribe(feature: PlatformFeatureCatalogItem) {
    if (!currentOrg || feature.comingSoon) return;
    setError(null);
    setMessage(null);
    setBusyId(`sub-${feature.id}`);
    try {
      const updated = await orgApi<OrganizationDto>('/organizations/features/subscribe', {
        method: 'POST',
        body: JSON.stringify({ featureId: feature.id }),
        organizationId: currentOrg.id,
      });
      patchCurrentOrg(updated);
      await refreshOrgs(currentOrg.id);
      setMessage(`${feature.name} subscribed — full access enabled.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
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
            ? `Install or uninstall features for ${currentOrg.name}. Premium features (Chat, Calls) also need a subscription after install.`
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
                  const isSub = subscribed.has(feature.id);
                  const uninstallAllowed = canUninstall(feature);
                  return (
                    <li key={feature.id} className="feature-card">
                      <div className="feature-card-top">
                        <strong>{feature.name}</strong>
                        {feature.comingSoon ? (
                          <span className="alert project-status">Soon</span>
                        ) : isOn && feature.requiresSubscription && isSub ? (
                          <span className="alert success project-status">Subscribed</span>
                        ) : isOn && feature.requiresSubscription ? (
                          <span className="alert project-status">Needs subscription</span>
                        ) : isOn ? (
                          <span className="alert success project-status">Installed</span>
                        ) : (
                          <span className="alert project-status">Available</span>
                        )}
                      </div>
                      <p className="muted">{feature.description}</p>
                      {feature.requiresSubscription ? (
                        <p className="muted tiny">Premium — install then subscribe</p>
                      ) : isProtectedProjectFeature(feature.id) ? (
                        <p className="muted tiny">
                          Core feature
                          {user?.isPlatformAdmin ? ' — platform admin may uninstall' : ''}
                        </p>
                      ) : feature.menuPaths.length > 0 ? (
                        <p className="muted tiny">Menus: {feature.menuPaths.join(', ')}</p>
                      ) : (
                        <p className="muted tiny">No sidebar menus yet</p>
                      )}
                      <div className="feature-card-actions">
                        <button
                          type="button"
                          className={`btn ${isOn ? 'ghost' : 'primary'} sm`}
                          disabled={
                            !!feature.comingSoon ||
                            busyId === feature.id ||
                            (isOn && !uninstallAllowed)
                          }
                          title={
                            isOn && !uninstallAllowed
                              ? 'Only a platform admin can uninstall this core feature'
                              : undefined
                          }
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
                        {isOn && feature.requiresSubscription && !isSub ? (
                          <button
                            type="button"
                            className="btn primary sm"
                            disabled={busyId === `sub-${feature.id}`}
                            onClick={() => void subscribe(feature)}
                          >
                            {busyId === `sub-${feature.id}` ? 'Enabling…' : 'Subscribe'}
                          </button>
                        ) : null}
                        {isOn && feature.requiresSubscription && !isSub ? (
                          <Link className="btn ghost sm" to={href(featureSubscribeAppPath(feature.id))}>
                            Checkout
                          </Link>
                        ) : null}
                      </div>
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
