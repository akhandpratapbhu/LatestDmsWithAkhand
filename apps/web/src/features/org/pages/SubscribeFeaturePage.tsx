import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  getFeatureById,
  isFeatureFullyEnabled,
  isFeatureSubscribed,
  type OrganizationDto,
} from '@dms/shared';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { PageHeader } from '../../../components/PageHeader';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../org-context';

/**
 * Paywall / mock Stripe checkout for premium features (chat, calls, …).
 * Project admins complete mock checkout; platform admins can grant the same way.
 */
export function SubscribeFeaturePage() {
  const { featureCode } = useParams<{ featureCode: string }>();
  const { currentOrg, patchCurrentOrg, refreshOrgs } = useOrg();
  const { user } = useAuth();
  const href = useWorkspaceHref();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feature = useMemo(
    () => (featureCode ? getFeatureById(decodeURIComponent(featureCode)) : undefined),
    [featureCode],
  );

  const installed = Boolean(feature && currentOrg?.enabledFeatures?.includes(feature.id));
  const subscribed = Boolean(
    feature && isFeatureSubscribed(feature.id, currentOrg?.featureSubscriptions),
  );
  const unlocked = Boolean(
    feature &&
      isFeatureFullyEnabled(
        feature.id,
        currentOrg?.enabledFeatures,
        currentOrg?.featureSubscriptions,
      ),
  );

  if (!feature) {
    return (
      <div>
        <PageHeader title="Subscription" description="Unknown feature." />
        <p className="muted">
          <Link to={href('/app/features')}>Back to Features</Link>
        </p>
      </div>
    );
  }

  if (!feature.requiresSubscription) {
    return <Navigate to={href(feature.menuPaths[0] ?? '/app/features')} replace />;
  }

  if (unlocked && feature.menuPaths[0]) {
    return <Navigate to={href(feature.menuPaths[0])} replace />;
  }

  async function completeCheckout(mode: 'checkout' | 'grant') {
    if (!currentOrg || !feature) return;
    setError(null);
    setBusy(true);
    try {
      if (!installed) {
        const installedOrg = await orgApi<OrganizationDto>('/organizations/features/install', {
          method: 'POST',
          body: JSON.stringify({ featureId: feature.id }),
          organizationId: currentOrg.id,
        });
        patchCurrentOrg(installedOrg);
      }
      const updated = await orgApi<OrganizationDto>('/organizations/features/subscribe', {
        method: 'POST',
        body: JSON.stringify({ featureId: feature.id }),
        organizationId: currentOrg.id,
      });
      patchCurrentOrg(updated);
      await refreshOrgs(currentOrg.id);
      const dest = feature.menuPaths[0] ?? '/app/features';
      navigate(href(dest));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'grant'
            ? 'Failed to grant subscription'
            : 'Checkout failed',
      );
    } finally {
      setBusy(false);
    }
  }

  async function uninstall() {
    if (!currentOrg || !feature) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await orgApi<OrganizationDto>('/organizations/features/uninstall', {
        method: 'POST',
        body: JSON.stringify({ featureId: feature.id }),
        organizationId: currentOrg.id,
      });
      patchCurrentOrg(updated);
      await refreshOrgs(currentOrg.id);
      navigate(href('/app/features'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="subscribe-page">
      <PageHeader
        title={`Enable ${feature.name}`}
        description={`Subscribe to unlock ${feature.name} for ${currentOrg?.name ?? 'this project'}.`}
      />

      {error && <div className="alert error">{error}</div>}

      <section className="subscribe-panel">
        <p className="muted">{feature.description}</p>

        <div className="subscribe-plan">
          <strong>{feature.name} plan</strong>
          <p className="muted tiny">
            Stripe-ready mock checkout. Completing payment (or an admin grant) marks the feature as
            subscribed for this project only.
          </p>
          <p className="subscribe-price">
            <span>$29</span>
            <small>/ month · mock</small>
          </p>
        </div>

        <div className="action-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !currentOrg}
            onClick={() => void completeCheckout('checkout')}
          >
            {busy ? 'Processing…' : 'Complete mock checkout'}
          </button>
          {user?.isPlatformAdmin ? (
            <button
              type="button"
              className="btn secondary"
              disabled={busy || !currentOrg}
              onClick={() => void completeCheckout('grant')}
            >
              {busy ? 'Granting…' : 'Grant as platform admin'}
            </button>
          ) : null}
          {installed ? (
            <button
              type="button"
              className="btn ghost"
              disabled={busy || !currentOrg}
              onClick={() => void uninstall()}
            >
              {busy ? 'Working…' : 'Uninstall feature'}
            </button>
          ) : null}
          <Link className="btn ghost" to={href('/app/features')}>
            Back to Features
          </Link>
        </div>

        {!installed ? (
          <p className="muted tiny" style={{ marginTop: '1rem' }}>
            This feature is not installed yet — checkout will install and subscribe in one step.
          </p>
        ) : subscribed ? (
          <p className="muted tiny" style={{ marginTop: '1rem' }}>
            Already subscribed.
          </p>
        ) : (
          <p className="muted tiny" style={{ marginTop: '1rem' }}>
            Installed but not subscribed — use checkout, uninstall, or ask a platform admin to grant
            access.
          </p>
        )}
      </section>
    </div>
  );
}
