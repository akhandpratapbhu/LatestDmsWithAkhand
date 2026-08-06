import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePlatformConfig } from '../features/org/platform-config-context';

/** Blocks a Configure System `/app/*` route when the matching platform shell feature is off. */
export function RequirePlatformFeature({
  featureId,
  children,
}: {
  featureId: string;
  children: ReactNode;
}) {
  const { enabledFeatures } = usePlatformConfig();

  if (!enabledFeatures.includes(featureId)) {
    return <Navigate to="/app/platform-features" replace />;
  }

  return <>{children}</>;
}
