import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/auth-context';
import { OrgProvider } from './features/org/org-context';
import { LoginPage } from './features/auth/pages/LoginPage';
import { RegisterPage } from './features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/pages/VerifyEmailPage';
import { OtpLoginPage } from './features/auth/pages/OtpLoginPage';
import { DashboardPage } from './features/auth/pages/DashboardPage';
import { SessionsPage } from './features/auth/pages/SessionsPage';
import { OrganizationPage } from './features/org/pages/OrganizationPage';
import { UsersPage } from './features/users/pages/UsersPage';
import { ProfilePage } from './features/users/pages/ProfilePage';
import { AcceptInvitePage } from './features/users/pages/AcceptInvitePage';
import { AuthLayout } from './components/AuthLayout';
import { AppShell } from './components/AppShell';

function Protected({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) {
    return <div className="page-center muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <OrgProvider>{children}</OrgProvider>;
}

function Guest({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) {
    return <div className="page-center muted">Loading…</div>;
  }
  if (user) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route
        element={
          <Guest>
            <AuthLayout />
          </Guest>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/otp-login" element={<OtpLoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
      </Route>

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/app" element={<DashboardPage />} />
        <Route path="/app/organization" element={<OrganizationPage />} />
        <Route path="/app/users" element={<UsersPage />} />
        <Route path="/app/profile" element={<ProfilePage />} />
        <Route path="/app/sessions" element={<SessionsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
