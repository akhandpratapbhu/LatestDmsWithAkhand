import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OrganizationDto, ProjectStatus } from '@dms/shared';
import { getProjectThemePreset, projectDashboardPath, resolveAppHref, suggestProjectSlug } from '@dms/shared';
import { useAuth } from '../../auth/auth-context';
import { useOrg } from '../org-context';

function statusClass(status: ProjectStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'DRAFT':
      return '';
    case 'ARCHIVED':
    case 'SUSPENDED':
      return 'error';
    default:
      return '';
  }
}

function isOwnedProject(project: OrganizationDto, userId: string | undefined): boolean {
  if (!userId) return false;
  if (project.ownerId === userId) return true;
  return project.membershipRole === 'OWNER';
}

/** Public login path: `/{slug}/login` — prefer slug, then subdomain, then slugified name. */
function projectPublicLoginPath(project: OrganizationDto): string {
  const key =
    project.slug?.trim() ||
    project.subdomain?.trim() ||
    suggestProjectSlug(project.name);
  return `/${encodeURIComponent(key)}/login`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isDbDropFailure(message: string): boolean {
  return (
    message.includes('Could not DROP Postgres database') ||
    message.includes('PROJECT_DB_DROP_FAILED') ||
    message.includes('without dropping the database')
  );
}

function ProjectLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'P';
  if (logoUrl) {
    return (
      <span className="project-logo">
        <img src={logoUrl} alt="" />
      </span>
    );
  }
  return (
    <span className="project-logo placeholder" aria-hidden>
      {initial}
    </span>
  );
}

export function ProjectsPage() {
  const { user } = useAuth();
  const { organizations, currentOrg, selectOrg, deleteOrg, loading } = useOrg();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<OrganizationDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OrganizationDto | null>(null);
  const [forceDeletePrompt, setForceDeletePrompt] = useState<OrganizationDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const myProjects = useMemo(() => {
    // Platform operators see every project; project admins see ones they own/belong to.
    if (user?.isPlatformAdmin) return organizations;
    return organizations.filter((p) => isOwnedProject(p, user?.id));
  }, [organizations, user?.id, user?.isPlatformAdmin]);

  useEffect(() => {
    if (!selected && !pendingDelete && !forceDeletePrompt) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelected(null);
        if (!deleting) {
          setPendingDelete(null);
          setForceDeletePrompt(null);
          setDeleteError(null);
        }
      }
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [selected, pendingDelete, forceDeletePrompt, deleting]);

  function projectKey(project: OrganizationDto): string {
    return (
      project.slug?.trim() ||
      project.subdomain?.trim() ||
      suggestProjectSlug(project.name)
    );
  }

  function openProject(project: OrganizationDto) {
    setSelected(null);
    navigate(projectPublicLoginPath(project));
  }

  function enterWorkspace(project: OrganizationDto) {
    selectOrg(project.id);
    setSelected(null);
    navigate(projectDashboardPath(projectKey(project)));
  }

  function addFeature(project: OrganizationDto) {
    selectOrg(project.id);
    setSelected(null);
    navigate(resolveAppHref('/app/features', projectKey(project)));
  }

  function manageForms(project: OrganizationDto) {
    selectOrg(project.id);
    setSelected(null);
    navigate(`/app/forms?projectId=${encodeURIComponent(project.id)}`);
  }

  function requestDelete(project: OrganizationDto, e?: { stopPropagation(): void; preventDefault(): void }) {
    e?.stopPropagation();
    e?.preventDefault();
    setSelected(null);
    setDeleteError(null);
    setForceDeletePrompt(null);
    setPendingDelete(project);
  }

  async function confirmDelete(project: OrganizationDto, force = false) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOrg(project.id, { force });
      setPendingDelete(null);
      setForceDeletePrompt(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      if (!force && isDbDropFailure(message)) {
        setPendingDelete(null);
        setForceDeletePrompt(project);
        setDeleteError(message);
      } else {
        setDeleteError(message);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="panel">
      <div className="action-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Project Dashboard</h1>
          <p className="lede">
            {user?.isPlatformAdmin
              ? 'All projects. Create one with a single project admin who manages IAM and features inside that project.'
              : 'Projects you own. Open one to work in its workspace, or add a feature to start building.'}
          </p>
        </div>
        {user?.isPlatformAdmin ? (
          <Link className="btn primary" to="/app/projects/new">
            Add Project
          </Link>
        ) : null}
      </div>

      {loading && <p className="muted">Loading projects…</p>}

      {!loading && myProjects.length === 0 && (
        <p className="muted">
          No projects yet.
          {user?.isPlatformAdmin ? (
            <>
              {' '}
              <Link to="/app/projects/new">Add your first project</Link>.
            </>
          ) : (
            ' Ask a platform admin to create one for you.'
          )}
        </p>
      )}

      <ul className="project-grid">
        {myProjects.map((project) => {
          const active = currentOrg?.id === project.id;
          return (
            <li key={project.id}>
              <div className={`project-card-wrap ${active ? 'current' : ''}`}>
                <button
                  type="button"
                  className={`project-card ${active ? 'current' : ''}`}
                  onClick={() => setSelected(project)}
                >
                  <div className="project-card-top">
                    <div className="project-card-identity">
                      <ProjectLogo name={project.name} logoUrl={project.logoUrl} />
                      <div>
                        <strong>{project.name}</strong>
                        <p className="muted tiny" style={{ margin: '0.15rem 0 0' }}>
                          v{project.version}
                          {project.databaseName ? ` · ${project.databaseName}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`alert ${statusClass(project.status)} project-status`}>
                      {project.status}
                    </span>
                  </div>
                  {project.description ? (
                    <p className="muted project-card-desc">{project.description}</p>
                  ) : null}
                  <p className="muted tiny">
                    Theme: {getProjectThemePreset(project.theme).label}
                    {project.code ? ` · ${project.code}` : ''}
                  </p>
                  <p className="muted tiny">
                    Created {formatDate(project.createdAt)} · Updated {formatDate(project.updatedAt)}
                  </p>
                  {active ? <span className="project-card-hint">Current project</span> : null}
                </button>
                {user?.isPlatformAdmin ? (
                  <button
                    type="button"
                    className="project-card-delete"
                    aria-label={`Delete ${project.name}`}
                    title="Delete project"
                    onClick={(e) => requestDelete(project, e)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div
          className="search-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div
            className="search-modal project-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-action-title"
          >
            <div className="search-modal-head">
              <div className="project-card-identity">
                <ProjectLogo name={selected.name} logoUrl={selected.logoUrl} />
                <div>
                  <h2 id="project-action-title">{selected.name}</h2>
                  <p className="lede">
                    {selected.code ? `${selected.code} · ` : ''}
                    {selected.slug}
                    {selected.databaseName ? ` · ${selected.databaseName}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="search-modal-body project-action-body">
              <button type="button" className="project-action-btn primary" onClick={() => enterWorkspace(selected)}>
                <strong>Open workspace</strong>
                <span>Enter this project's workspace ({projectDashboardPath(projectKey(selected))}).</span>
              </button>
              <button type="button" className="project-action-btn" onClick={() => openProject(selected)}>
                <strong>Open public login</strong>
                <span>Open this project's public login page ({projectPublicLoginPath(selected)}).</span>
              </button>
              <button type="button" className="project-action-btn" onClick={() => addFeature(selected)}>
                <strong>Add new feature</strong>
                <span>Select this project and open the Features marketplace.</span>
              </button>
              <button type="button" className="project-action-btn" onClick={() => manageForms(selected)}>
                <strong>Manage forms</strong>
                <span>Configure dynamic forms for this project from Configure System.</span>
              </button>
              <Link
                className="btn ghost"
                to={`/app/projects/${selected.id}/settings`}
                onClick={() => {
                  selectOrg(selected.id);
                  setSelected(null);
                }}
              >
                Project settings
              </Link>
              {user?.isPlatformAdmin ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => requestDelete(selected)}
                >
                  Delete project
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="search-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setPendingDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            className="search-modal project-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-delete-title"
          >
            <div className="search-modal-head">
              <div>
                <h2 id="project-delete-title">Delete project?</h2>
                <p className="lede">
                  This permanently removes <strong>{pendingDelete.name}</strong>
                  {pendingDelete.databaseName ? (
                    <>
                      {' '}
                      and drops Postgres database <code>{pendingDelete.databaseName}</code>
                    </>
                  ) : null}
                  . Members, forms, and related platform data for this project will be deleted.
                </p>
              </div>
            </div>
            <div className="search-modal-body">
              {deleteError ? <div className="alert error">{deleteError}</div> : null}
              <div className="action-row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={deleting}
                  onClick={() => {
                    setPendingDelete(null);
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={deleting}
                  onClick={() => void confirmDelete(pendingDelete)}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {forceDeletePrompt && (
        <div
          className="search-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setForceDeletePrompt(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            className="search-modal project-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-force-delete-title"
          >
            <div className="search-modal-head">
              <div>
                <h2 id="project-force-delete-title">Remove project metadata anyway?</h2>
                <p className="lede">
                  Could not drop the project database
                  {forceDeletePrompt.databaseName ? (
                    <>
                      {' '}
                      (<code>{forceDeletePrompt.databaseName}</code>)
                    </>
                  ) : null}
                  . You can still remove Configure System metadata for{' '}
                  <strong>{forceDeletePrompt.name}</strong>; you may need to drop the database
                  manually later.
                </p>
              </div>
            </div>
            <div className="search-modal-body">
              {deleteError ? <div className="alert error">{deleteError}</div> : null}
              <div className="action-row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={deleting}
                  onClick={() => {
                    setForceDeletePrompt(null);
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={deleting}
                  onClick={() => void confirmDelete(forceDeletePrompt, true)}
                >
                  {deleting ? 'Removing…' : 'Yes, remove metadata'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
