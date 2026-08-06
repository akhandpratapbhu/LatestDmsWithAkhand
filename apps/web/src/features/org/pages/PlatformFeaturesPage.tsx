import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  displayFeatureName,
  isProtectedPlatformFeature,
  PLATFORM_SHELL_FEATURE_CATALOG,
  type PlatformConfigDto,
  type PlatformFeatureCatalogItem,
} from '@dms/shared';
import { api } from '../../../lib/api';
import { PageHeader } from '../../../components/PageHeader';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../org-context';
import { usePlatformConfig } from '../platform-config-context';

export function PlatformFeaturesPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const { config, refresh, setConfig } = usePlatformConfig();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const installed = useMemo(
    () => new Set(config?.enabledFeatures ?? []),
    [config?.enabledFeatures],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, PlatformFeatureCatalogItem[]>();
    for (const feature of PLATFORM_SHELL_FEATURE_CATALOG) {
      const list = map.get(feature.category) ?? [];
      list.push(feature);
      map.set(feature.category, list);
    }
    return [...map.entries()];
  }, []);

  async function toggle(feature: PlatformFeatureCatalogItem) {
    if (!user?.isPlatformAdmin || feature.comingSoon) return;
    const installing = !installed.has(feature.id);
    if (!installing && isProtectedPlatformFeature(feature.id)) {
      setError(`${feature.name} is a core Configure System feature and cannot be uninstalled.`);
      return;
    }
    setError(null);
    setMessage(null);
    setBusyId(feature.id);
    try {
      const updated = await api<PlatformConfigDto>(
        `/platform/features/${installing ? 'install' : 'uninstall'}`,
        {
          method: 'POST',
          body: JSON.stringify({ featureId: feature.id }),
        },
      );
      setConfig(updated);
      await refresh();
      setMessage(
        installing
          ? `${feature.name} enabled on Configure System.`
          : `${feature.name} disabled on Configure System.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update platform feature');
    } finally {
      setBusyId(null);
    }
  }

  if (!user?.isPlatformAdmin) {
    return (
      <section className="panel">
        <h1>Platform features</h1>
        <div className="alert error">Only a platform admin can manage Configure System features.</div>
        <Link className="btn ghost" to="/app/projects">
          Back to projects
        </Link>
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title="Platform features"
        description="Same feature catalog as project Features (e.g. /divya-hospital/features), plus Configure System cores (Projects, Platform features). Enable or disable for the platform shell."
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="action-row" style={{ marginBottom: '1rem' }}>
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
              const protectedFeature = isProtectedPlatformFeature(feature.id);
              const title = displayFeatureName(feature, currentOrg?.name);
              return (
                <li key={feature.id} className="feature-card">
                  <div className="feature-card-top">
                    <strong>{title}</strong>
                    {feature.comingSoon ? (
                      <span className="alert project-status">Soon</span>
                    ) : isOn && feature.requiresSubscription ? (
                      <span className="alert success project-status">Enabled (premium)</span>
                    ) : isOn ? (
                      <span className="alert success project-status">Enabled</span>
                    ) : (
                      <span className="alert project-status">Disabled</span>
                    )}
                  </div>
                  <p className="muted">{feature.description}</p>
                  {protectedFeature ? (
                    <p className="muted tiny">Core — always on</p>
                  ) : feature.requiresSubscription ? (
                    <p className="muted tiny">Premium on projects — platform toggle only gates Availability here</p>
                  ) : feature.menuPaths.length > 0 ? (
                    <p className="muted tiny">Menus: {feature.menuPaths.join(', ')}</p>
                  ) : null}
                  <div className="feature-card-actions">
                    <button
                      type="button"
                      className={`btn ${isOn ? 'ghost' : 'primary'} sm`}
                      disabled={
                        !!feature.comingSoon ||
                        busyId === feature.id ||
                        (isOn && protectedFeature)
                      }
                      onClick={() => void toggle(feature)}
                    >
                      {feature.comingSoon
                        ? 'Coming soon'
                        : busyId === feature.id
                          ? 'Saving…'
                          : isOn
                            ? 'Disable'
                            : 'Enable'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
