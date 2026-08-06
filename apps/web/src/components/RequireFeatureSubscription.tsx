import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  featureRequiresSubscription,
  featureSubscribeAppPath,
  isFeatureFullyEnabled,
} from '@dms/shared';
import { useOrg } from '../features/org/org-context';
import { useWorkspaceHref } from '../lib/workspace-path';

/**
 * Blocks a route when the feature is not installed, or (for premium features)
 * installed but not subscribed. Free features only need to be installed.
 */
export function RequireFeatureSubscription({
  featureId,
  children,
}: {
  featureId: string;
  children: ReactNode;
}) {
  const { currentOrg } = useOrg();
  const href = useWorkspaceHref();

  const enabled = currentOrg?.enabledFeatures ?? [];
  const subscribed = currentOrg?.featureSubscriptions;
  const unlocked = isFeatureFullyEnabled(featureId, enabled, subscribed);

  if (unlocked) {
    return <>{children}</>;
  }

  // Installed but needs subscription → paywall
  if (featureRequiresSubscription(featureId) && enabled.includes(featureId)) {
    return <Navigate to={href(featureSubscribeAppPath(featureId))} replace />;
  }

  // Not installed → Features marketplace (always reachable via Projects too)
  return <Navigate to={href('/app/features')} replace />;
}
