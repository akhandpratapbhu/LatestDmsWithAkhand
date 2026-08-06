import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import {
  RESERVED_PROJECT_SLUGS,
  projectLoginPath,
  resolveAppHref,
} from '@dms/shared';
import { useAuth } from './features/auth/auth-context';
import { OrgProvider, useOrg } from './features/org/org-context';
import { PlatformConfigProvider } from './features/org/platform-config-context';
import { IamProvider } from './features/iam/iam-context';
import { LoginPage } from './features/auth/pages/LoginPage';
import { RegisterPage } from './features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/pages/VerifyEmailPage';
import { OtpLoginPage } from './features/auth/pages/OtpLoginPage';
import { DashboardPage } from './features/auth/pages/DashboardPage';
import { SessionsPage } from './features/auth/pages/SessionsPage';
import { ProjectsPage } from './features/org/pages/ProjectsPage';
import { CreateProjectPage } from './features/org/pages/CreateProjectPage';
import { ProjectSettingsPage } from './features/org/pages/ProjectSettingsPage';
import { FeaturesPage } from './features/org/pages/FeaturesPage';
import { PlatformFeaturesPage } from './features/org/pages/PlatformFeaturesPage';
import { SubscribeFeaturePage } from './features/org/pages/SubscribeFeaturePage';
import { LoginPageSettingsPage } from './features/org/pages/LoginPageSettingsPage';
import { UsersPage } from './features/users/pages/UsersPage';
import { ProfilePage } from './features/users/pages/ProfilePage';
import { AcceptInvitePage } from './features/users/pages/AcceptInvitePage';
import { IamPage } from './features/iam/pages/IamPage';
import { MenuBuilderPage } from './features/iam/pages/MenuBuilderPage';
import { DashboardsAdminPage } from './features/dashboards/pages/DashboardsAdminPage';
import { FormsPage } from './features/forms/pages/FormsPage';
import { FormRecordsPage } from './features/forms/pages/FormRecordsPage';
import { FormRecordFormPage } from './features/forms/pages/FormRecordFormPage';
import { GridsPage } from './features/grids/pages/GridsPage';
import { NotificationsPage } from './features/notifications/pages/NotificationsPage';
import { ActivityPage, AuditPage } from './features/audit/pages/ActivityAuditPages';
import { ChatPage } from './features/chat/pages/ChatPage';
import { ProjectLoginPage } from './features/auth/pages/ProjectLoginPage';
import { CallsPage } from './features/calls/pages/CallsPage';
import { BookAppointmentPage } from './features/hospital/pages/BookAppointmentPage';
import { MyAppointmentsPage } from './features/hospital/pages/MyAppointmentsPage';
import { DoctorSchedulePage } from './features/hospital/pages/DoctorSchedulePage';
import { DoctorPatientsPage } from './features/hospital/pages/DoctorPatientsPage';
import { PatientProfilePage } from './features/hospital/pages/PatientProfilePage';
import { AuthLayout } from './components/AuthLayout';
import { AppShell } from './components/AppShell';
import { RequireFeatureSubscription } from './components/RequireFeatureSubscription';
import { RequirePlatformFeature } from './components/RequirePlatformFeature';

function Protected({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) {
    return <div className="page-center muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <OrgProvider>
      <PlatformConfigProvider>
        <IamProvider>{children}</IamProvider>
      </PlatformConfigProvider>
    </OrgProvider>
  );
}

/** Auth required; unauthenticated users go to the project login page. */
function ProjectProtected({ children }: { children: ReactNode }) {
  const { projectSlug = '' } = useParams<{ projectSlug: string }>();
  const { user, bootstrapping } = useAuth();

  if (RESERVED_PROJECT_SLUGS.has(projectSlug.trim().toLowerCase())) {
    return <Navigate to="/login" replace />;
  }
  if (bootstrapping) {
    return <div className="page-center muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to={projectLoginPath(projectSlug)} replace />;
  }
  return (
    <OrgProvider>
      <PlatformConfigProvider>
        <IamProvider>
          <ProjectWorkspaceGuard>{children}</ProjectWorkspaceGuard>
        </IamProvider>
      </PlatformConfigProvider>
    </OrgProvider>
  );
}

/** Ensure the URL slug matches a project the user belongs to and select it. */
function ProjectWorkspaceGuard({ children }: { children: ReactNode }) {
  const { projectSlug = '' } = useParams<{ projectSlug: string }>();
  const { organizations, currentOrg, selectOrg, loading } = useOrg();
  const key = projectSlug.trim().toLowerCase();

  const match = organizations.find((o) => {
    const slug = o.slug?.trim().toLowerCase();
    const subdomain = o.subdomain?.trim().toLowerCase();
    const code = o.code?.trim().toLowerCase();
    return slug === key || subdomain === key || code === key;
  });

  useLayoutEffect(() => {
    if (match && currentOrg?.id !== match.id) {
      selectOrg(match.id);
    }
  }, [match, currentOrg?.id, selectOrg]);

  if (loading && organizations.length === 0) {
    return <div className="page-center muted">Loading…</div>;
  }

  if (!match) {
    return <Navigate to={projectLoginPath(projectSlug)} replace />;
  }

  return <>{children}</>;
}

function Guest({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) {
    return <div className="page-center muted">Loading…</div>;
  }
  if (user) {
    return <Navigate to="/app/projects" replace />;
  }
  return <>{children}</>;
}

/** Public project login; rejects reserved top-level segments (e.g. `/app/login`). */
function ProjectLoginRoute() {
  const { projectSlug = '' } = useParams<{ projectSlug: string }>();
  if (RESERVED_PROJECT_SLUGS.has(projectSlug.trim().toLowerCase())) {
    return <Navigate to="/login" replace />;
  }
  return <ProjectLoginPage />;
}

/** Legacy `/p/:slug/login` → `/:slug/login`. */
function LegacyProjectLoginRedirect() {
  const { projectSlug = '' } = useParams<{ projectSlug: string }>();
  const [searchParams] = useSearchParams();
  const q = searchParams.toString();
  return <Navigate to={`${projectLoginPath(projectSlug)}${q ? `?${q}` : ''}`} replace />;
}

/** Old `/app/...` workspace bookmarks → `/{currentOrg.slug}/...`. */
function LegacyWorkspaceRedirect({ appPath }: { appPath: string }) {
  const { currentOrg, loading } = useOrg();
  if (loading && !currentOrg) {
    return <div className="page-center muted">Loading…</div>;
  }
  const slug = currentOrg?.slug?.trim();
  if (!slug) {
    return <Navigate to="/app/projects" replace />;
  }
  return <Navigate to={resolveAppHref(appPath, slug)} replace />;
}

function LegacyFormDataRedirect() {
  const { formId = '' } = useParams<{ formId: string }>();
  return <LegacyWorkspaceRedirect appPath={`/app/data/${formId}`} />;
}

function LegacyFormRecordNewRedirect() {
  const { formId = '' } = useParams<{ formId: string }>();
  return <LegacyWorkspaceRedirect appPath={`/app/data/${formId}/new`} />;
}

function LegacyFormRecordEditRedirect() {
  const { formId = '', submissionId = '' } = useParams<{
    formId: string;
    submissionId: string;
  }>();
  return (
    <LegacyWorkspaceRedirect appPath={`/app/data/${formId}/${submissionId}/edit`} />
  );
}

function LegacyFormRecordViewRedirect() {
  const { formId = '', submissionId = '' } = useParams<{
    formId: string;
    submissionId: string;
  }>();
  return <LegacyWorkspaceRedirect appPath={`/app/data/${formId}/${submissionId}`} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public project-branded login (works while signed in so settings Preview works) */}
      <Route path="/:projectSlug/login" element={<ProjectLoginRoute />} />
      {/* Backward-compatible redirect from older `/p/...` URLs */}
      <Route path="/p/:projectSlug/login" element={<LegacyProjectLoginRedirect />} />

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

      {/* Platform shell: project list / create / settings */}
      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/app" element={<Navigate to="/app/projects" replace />} />
        <Route path="/app/projects" element={<ProjectsPage />} />
        <Route path="/app/projects/new" element={<CreateProjectPage />} />
        <Route path="/app/projects/:projectId/settings" element={<ProjectSettingsPage />} />
        <Route path="/app/platform-features" element={<PlatformFeaturesPage />} />
        <Route
          path="/app/forms"
          element={
            <RequirePlatformFeature featureId="forms">
              <FormsPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/features"
          element={
            <RequirePlatformFeature featureId="features">
              <FeaturesPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/features/subscribe/:featureCode"
          element={
            <RequirePlatformFeature featureId="features">
              <SubscribeFeaturePage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/settings/login"
          element={
            <RequirePlatformFeature featureId="login-page">
              <LoginPageSettingsPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/users"
          element={
            <RequirePlatformFeature featureId="users">
              <UsersPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/iam"
          element={
            <RequirePlatformFeature featureId="roles">
              <IamPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/dashboards"
          element={
            <RequirePlatformFeature featureId="reports">
              <DashboardsAdminPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/menus"
          element={
            <RequirePlatformFeature featureId="menu-builder">
              <MenuBuilderPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/grids"
          element={
            <RequirePlatformFeature featureId="grids">
              <GridsPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/notifications"
          element={
            <RequirePlatformFeature featureId="notifications">
              <NotificationsPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/activity"
          element={
            <RequirePlatformFeature featureId="activity">
              <ActivityPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/audit"
          element={
            <RequirePlatformFeature featureId="audit">
              <AuditPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/chat"
          element={
            <RequirePlatformFeature featureId="chat">
              <ChatPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/calls"
          element={
            <RequirePlatformFeature featureId="calls">
              <CallsPage />
            </RequirePlatformFeature>
          }
        />
        <Route
          path="/app/sessions"
          element={
            <RequirePlatformFeature featureId="sessions">
              <SessionsPage />
            </RequirePlatformFeature>
          }
        />
        <Route path="/app/profile" element={<ProfilePage />} />
        <Route path="/app/organization" element={<Navigate to="/app/projects" replace />} />
        <Route path="/app/masters" element={<Navigate to="/app/projects" replace />} />

        {/* Form data deep-links still resolve into the selected project workspace */}
        <Route path="/app/data/:formId/new" element={<LegacyFormRecordNewRedirect />} />
        <Route
          path="/app/data/:formId/:submissionId/edit"
          element={<LegacyFormRecordEditRedirect />}
        />
        <Route
          path="/app/data/:formId/:submissionId"
          element={<LegacyFormRecordViewRedirect />}
        />
        <Route path="/app/data/:formId" element={<LegacyFormDataRedirect />} />
      </Route>

      {/* Project workspace: `/{slug}/dashboard`, `/{slug}/users`, … */}
      <Route
        path="/:projectSlug"
        element={
          <ProjectProtected>
            <AppShell />
          </ProjectProtected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="features/subscribe/:featureCode" element={<SubscribeFeaturePage />} />
        <Route path="settings/login" element={<LoginPageSettingsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="iam" element={<IamPage />} />
        <Route path="dashboards" element={<DashboardsAdminPage />} />
        <Route path="forms" element={<FormsPage />} />
        <Route
          path="menus"
          element={
            <RequireFeatureSubscription featureId="menu-builder">
              <MenuBuilderPage />
            </RequireFeatureSubscription>
          }
        />
        <Route
          path="data/:formId/new"
          element={
            <RequireFeatureSubscription featureId="project-forms">
              <FormRecordFormPage mode="create" />
            </RequireFeatureSubscription>
          }
        />
        <Route
          path="data/:formId/:submissionId/edit"
          element={
            <RequireFeatureSubscription featureId="project-forms">
              <FormRecordFormPage mode="edit" />
            </RequireFeatureSubscription>
          }
        />
        <Route
          path="data/:formId/:submissionId"
          element={
            <RequireFeatureSubscription featureId="project-forms">
              <FormRecordFormPage mode="view" />
            </RequireFeatureSubscription>
          }
        />
        <Route
          path="data/:formId"
          element={
            <RequireFeatureSubscription featureId="project-forms">
              <FormRecordsPage />
            </RequireFeatureSubscription>
          }
        />
        <Route path="grids" element={<GridsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route
          path="activity"
          element={
            <RequireFeatureSubscription featureId="activity">
              <ActivityPage />
            </RequireFeatureSubscription>
          }
        />
        <Route
          path="audit"
          element={
            <RequireFeatureSubscription featureId="audit">
              <AuditPage />
            </RequireFeatureSubscription>
          }
        />
        <Route
          path="chat"
          element={
            <RequireFeatureSubscription featureId="chat">
              <ChatPage />
            </RequireFeatureSubscription>
          }
        />
        <Route
          path="calls"
          element={
            <RequireFeatureSubscription featureId="calls">
              <CallsPage />
            </RequireFeatureSubscription>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="sessions"
          element={
            <RequireFeatureSubscription featureId="sessions">
              <SessionsPage />
            </RequireFeatureSubscription>
          }
        />
        <Route path="hospital/book" element={<BookAppointmentPage />} />
        <Route path="hospital/my-appointments" element={<MyAppointmentsPage />} />
        <Route path="hospital/schedule" element={<DoctorSchedulePage />} />
        <Route path="hospital/patients" element={<DoctorPatientsPage />} />
        <Route path="hospital/profile" element={<PatientProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
